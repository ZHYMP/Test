<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

include '../../database.php';

if (!$conn) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Check if user is logged in
if (!isset($_SESSION['user_email'])) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Get current user info
$userStmt = $conn->prepare("SELECT id, role FROM users WHERE email = ? LIMIT 1");
$userStmt->bind_param("s", $_SESSION['user_email']);
$userStmt->execute();
$userResult = $userStmt->get_result();
$currentUser = $userResult->fetch_assoc();
$userStmt->close();

if (!$currentUser) {
    echo json_encode(['error' => 'User not found']);
    exit;
}

// Get recent activities for the logged-in employee (last 5)
// Only show activities where the employee is the user performing the action
$query = "
    SELECT 
        ra.id,
        ra.action,
        f.name AS fileName,
        u.name AS user,
        CASE 
            WHEN TIMESTAMPDIFF(MINUTE, ra.created_at, NOW()) < 1 THEN 'Just now'
            WHEN TIMESTAMPDIFF(MINUTE, ra.created_at, NOW()) < 60 THEN CONCAT(TIMESTAMPDIFF(MINUTE, ra.created_at, NOW()), ' minutes ago')
            WHEN TIMESTAMPDIFF(HOUR, ra.created_at, NOW()) < 24 THEN CONCAT(TIMESTAMPDIFF(HOUR, ra.created_at, NOW()), ' hours ago')
            ELSE CONCAT(TIMESTAMPDIFF(DAY, ra.created_at, NOW()), ' days ago')
        END AS timestamp
    FROM recent_activities ra
    LEFT JOIN users u ON ra.user_id = u.id
    LEFT JOIN files f ON ra.file_id = f.id
    WHERE ra.user_id = ?
    ORDER BY ra.created_at DESC
    LIMIT 5
";

$stmt = $conn->prepare($query);
$stmt->bind_param("i", $currentUser['id']);
$stmt->execute();
$result = $stmt->get_result();

$activities = [];
while ($row = $result->fetch_assoc()) {
    // Set icon based on action
    $icons = [
        'approved' => '../assets/approved.svg',
        'rejected' => '../assets/rejected.svg',
        'commented' => '../assets/return_with_feedback.svg',
        'uploaded' => '../assets/docs_blue.svg',
        'signed' => '../assets/signatory.svg',
        'modified' => '../assets/docs_blue.svg',
        'deleted' => '../assets/rejected.svg'
    ];
    
    $row['icon'] = $icons[$row['action']] ?? '../assets/docs_blue.svg';
    
    // Map action names for display
    if ($row['action'] === 'commented') {
        $row['action'] = 'returned';
    }
    
    $activities[] = $row;
}

echo json_encode($activities);
?>
