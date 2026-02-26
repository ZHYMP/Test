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

// Fetch all users with their last message - improved query
$query = "
    SELECT 
        u.id,
        u.name,
        u.username,
        u.department,
        u.role,
        COALESCE(m.lastMessage, 'No messages yet') AS lastMessage,
        COALESCE(m.lastTime, 'Now') AS lastMessageTime,
        COALESCE(m.created_at, '1970-01-01') AS sortTime
    FROM users u
    LEFT JOIN (
        SELECT 
            CASE 
                WHEN sender_id = ? THEN receiver_id 
                ELSE sender_id 
            END as user_id,
            message as lastMessage,
            DATE_FORMAT(created_at, '%H:%i') as lastTime,
            created_at,
            ROW_NUMBER() OVER (
                PARTITION BY CASE 
                    WHEN sender_id = ? THEN receiver_id 
                    ELSE sender_id 
                END 
                ORDER BY created_at DESC
            ) as rn
        FROM messages 
        WHERE sender_id = ? OR receiver_id = ?
    ) m ON (u.id = m.user_id AND m.rn = 1)
    WHERE u.id != ?
    ORDER BY sortTime DESC, u.name ASC
";

$stmt = $conn->prepare($query);
$stmt->bind_param("iiiii", $currentUserId, $currentUserId, $currentUserId, $currentUserId, $currentUserId);
$stmt->execute();
$result = $stmt->get_result();

$conversations = [];
while ($row = $result->fetch_assoc()) {
    $conversations[] = [
        'id' => $row['id'],
        'name' => $row['name'],
        'username' => $row['username'],
        'department' => $row['department'],
        'role' => $row['role'],
        'lastMessage' => $row['lastMessage'],
        'lastMessageTime' => $row['lastMessageTime']
    ];
}

$stmt->close();
$conn->close();

echo json_encode($conversations);
?>
