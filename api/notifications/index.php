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

// Handle GET request - Fetch notifications for current user
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Admin can view notifications for specific user (for messaging view)
    $targetUserId = $currentUserId;
    if ($currentUser['role'] === 'admin' && isset($_GET['userId'])) {
        $targetUserId = intval($_GET['userId']);
    }
    
    $query = "
        SELECT 
            n.id AS notificationId,
            n.title,
            n.message AS text,
            n.type,
            n.is_read AS isRead,
            n.related_file_id AS fileId,
            f.name AS fileName,
            DATE_FORMAT(n.created_at, '%H:%i') AS timestamp,
            DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s') AS fullTimestamp
        FROM notifications n
        LEFT JOIN files f ON n.related_file_id = f.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50
    ";

    $stmt = $conn->prepare($query);
    $stmt->bind_param("i", $targetUserId);
    $stmt->execute();
    $result = $stmt->get_result();

    $notifications = [];
    while ($row = $result->fetch_assoc()) {
        // Map notification type to status for styling
        $statusMap = [
            'success' => 'approved',
            'error' => 'declined',
            'warning' => 'returned',
            'info' => 'info'
        ];
        
        $notifications[] = [
            'notificationId' => $row['notificationId'],
            'title' => $row['title'],
            'text' => $row['text'],
            'type' => 'notification',
            'status' => $statusMap[$row['type']] ?? 'info',
            'isRead' => (bool)$row['isRead'],
            'fileId' => $row['fileId'],
            'fileName' => $row['fileName'],
            'timestamp' => $row['timestamp'],
            'fullTimestamp' => $row['fullTimestamp']
        ];
    }

    $stmt->close();
    echo json_encode($notifications);
    exit;
}

// Handle PUT request - Mark notification as read
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['notificationId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'notificationId is required']);
        exit;
    }

    $notificationId = intval($data['notificationId']);

    // Update notification to mark as read
    $updateQuery = "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?";
    $stmt = $conn->prepare($updateQuery);
    $stmt->bind_param("ii", $notificationId, $currentUserId);

    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Notification marked as read'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update notification']);
    }
    $stmt->close();
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
$conn->close();
?>
