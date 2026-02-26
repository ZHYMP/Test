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

// Handle GET request - Fetch messages between current user and another user (typically admin)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_GET['userId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'userId parameter required']);
        exit;
    }

    $otherUserId = intval($_GET['userId']);

    // Fetch messages between current user and the other user
    // Join with the OTHER user's info (the person we're chatting with)
    $query = "
        SELECT 
            m.id AS messageId,
            m.sender_id AS senderId,
            m.receiver_id AS receiverId,
            CASE 
                WHEN m.sender_id = ? THEN 'You'
                ELSE other_user.name
            END AS sender,
            m.message AS text,
            m.message_type,
            CASE 
                WHEN m.message_type = 'notification' THEN 'notification'
                WHEN m.sender_id = ? THEN 'sent'
                ELSE 'received'
            END AS type,
            DATE_FORMAT(m.created_at, '%H:%i') AS timestamp,
            DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS fullTimestamp
        FROM messages m
        LEFT JOIN users other_user ON other_user.id = ?
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
    ";

    $stmt = $conn->prepare($query);
    // Bind parameters: currentUserId for CASE, currentUserId for type CASE, otherUserId for JOIN, then the WHERE clause params
    $stmt->bind_param("iiiiiii", $currentUserId, $currentUserId, $otherUserId, $currentUserId, $otherUserId, $otherUserId, $currentUserId);
    $stmt->execute();
    $result = $stmt->get_result();

    $messages = [];
    while ($row = $result->fetch_assoc()) {
        $message = [
            'messageId' => $row['messageId'],
            'sender' => $row['sender'],
            'text' => $row['text'],
            'type' => $row['type'],
            'timestamp' => $row['timestamp'],
            'fullTimestamp' => $row['fullTimestamp'],
            'senderId' => $row['senderId'],
            'receiverId' => $row['receiverId']
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
    $conn->close();
    
    // Log for debugging
    error_log("Employee Chat API - Current User: $currentUserId, Other User: $otherUserId, Count: " . count($messages));
    
    echo json_encode($messages);
    exit;
}

// For other methods, return error
http_response_code(405);
echo json_encode(['error' => 'Method not allowed. Use GET to fetch messages.']);
exit;
?>
