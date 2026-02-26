<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

// Check if user is logged in
if (!isset($_SESSION['user_email'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

require_once '../../database.php';

// Get current user info
$email = $_SESSION['user_email'];
$userQuery = $conn->prepare("SELECT id, role FROM users WHERE email = ?");
$userQuery->bind_param("s", $email);
$userQuery->execute();
$userResult = $userQuery->get_result();
$currentUser = $userResult->fetch_assoc();
$userQuery->close();

if (!$currentUser) {
    http_response_code(401);
    echo json_encode(['error' => 'User not found']);
    exit;
}

$currentUserId = $currentUser['id'];

// Handle GET request - Fetch messages between current user and another user
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_GET['userId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'userId parameter required']);
        exit;
    }

    $otherUserId = intval($_GET['userId']);

    // Fetch messages between current user and the other user
    $query = "
        SELECT 
            m.id AS messageId,
            CASE 
                WHEN m.sender_id = ? THEN 'You'
                ELSE u.name
            END AS sender,
            m.message AS text,
            m.message_type,
            CASE 
                WHEN m.message_type = 'notification' THEN m.message_type
                WHEN m.sender_id = ? THEN 'sent'
                ELSE 'received'
            END AS type,
            DATE_FORMAT(m.created_at, '%H:%i') AS timestamp
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
    ";

    $stmt = $conn->prepare($query);
    $stmt->bind_param("iiiiii", $currentUserId, $currentUserId, $currentUserId, $otherUserId, $otherUserId, $currentUserId);
    $stmt->execute();
    $result = $stmt->get_result();

    $messages = [];
    while ($row = $result->fetch_assoc()) {
        $message = [
            'messageId' => $row['messageId'],
            'sender' => $row['sender'],
            'text' => $row['text'],
            'type' => $row['type'],
            'timestamp' => $row['timestamp']
        ];
        
        // Add status for notification messages
        if ($row['message_type'] === 'notification') {
            // Extract status from message text
            if (stripos($row['text'], 'approved') !== false) {
                $message['status'] = 'approved';
            } elseif (stripos($row['text'], 'declined') !== false) {
                $message['status'] = 'declined';
            } elseif (stripos($row['text'], 'returned') !== false) {
                $message['status'] = 'returned';
            } else {
                $message['status'] = 'approved';
            }
        }
        
        $messages[] = $message;
    }

    $stmt->close();
    echo json_encode($messages);
    exit;
}

// Handle POST request - Send a message
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['recipientId']) || !isset($data['message'])) {
        http_response_code(400);
        echo json_encode(['error' => 'recipientId and message are required']);
        exit;
    }

    $recipientId = intval($data['recipientId']);
    $message = trim($data['message']);

    if (empty($message)) {
        http_response_code(400);
        echo json_encode(['error' => 'Message cannot be empty']);
        exit;
    }

    // Insert message
    $insertQuery = "INSERT INTO messages (sender_id, receiver_id, message, message_type) VALUES (?, ?, ?, 'sent')";
    $stmt = $conn->prepare($insertQuery);
    $stmt->bind_param("iis", $currentUserId, $recipientId, $message);

    if ($stmt->execute()) {
        $messageId = $conn->insert_id;
        $stmt->close();

        // Return the newly created message
        echo json_encode([
            'success' => true,
            'messageId' => $messageId,
            'message' => 'Message sent successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to send message']);
        $stmt->close();
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
$conn->close();
?>
