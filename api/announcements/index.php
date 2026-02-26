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
$userQuery = $conn->prepare("SELECT id, role, name FROM users WHERE email = ?");
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
$currentUserRole = $currentUser['role'];
$currentUserName = $currentUser['name'];

// Handle GET request - Fetch announcements
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Check if this is a request for history (admin only)
    $isHistoryRequest = isset($_GET['history']) && $_GET['history'] === 'true';
    
    if ($isHistoryRequest && $currentUserRole === 'admin') {
        // Fetch all announcements sent by admin (grouped by unique message)
        $query = "
            SELECT 
                n.message,
                n.title AS author,
                DATE_FORMAT(n.created_at, '%b %d, %Y at %H:%i') AS date,
                n.created_at,
                COUNT(DISTINCT n.user_id) as recipient_count
            FROM notifications n
            WHERE n.type = 'info'
            GROUP BY n.message, n.created_at, n.title
            ORDER BY n.created_at DESC
            LIMIT 50
        ";
        
        $result = $conn->query($query);
        $announcements = [];
        
        while ($row = $result->fetch_assoc()) {
            $announcements[] = [
                'message' => $row['message'],
                'author' => 'Announcement',
                'date' => $row['date'],
                'recipient_count' => $row['recipient_count']
            ];
        }
        
        echo json_encode($announcements);
        exit;
    }
    
    // Fetch all announcements (not filtered by user) so all employees see all announcements
    // Group by message and created_at to avoid duplicates since same announcement is sent to all users
    $query = "
        SELECT 
            MIN(n.id) as id,
            n.title AS author,
            n.message,
            DATE_FORMAT(n.created_at, '%b %d, %Y') AS date,
            n.created_at
        FROM notifications n
        WHERE n.type = 'info'
        GROUP BY n.message, n.created_at, n.title
        ORDER BY n.created_at DESC
        LIMIT 50
    ";

    $result = $conn->query($query);
    
    $announcements = [];

    while ($row = $result->fetch_assoc()) {
        $announcements[] = [
            'id' => $row['id'],
            'author' => 'Announcement',
            'message' => $row['message'],
            'date' => $row['date']
        ];
    }

    echo json_encode($announcements);
    exit;
}

// Handle POST request - Create announcement (admin only)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Only admins can create announcements
    if ($currentUserRole !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Only admins can create announcements']);
        exit;
    }

    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['message']) || empty(trim($data['message']))) {
        http_response_code(400);
        echo json_encode(['error' => 'Message is required']);
        exit;
    }

    $message = trim($data['message']);

    if (strlen($message) > 500) {
        http_response_code(400);
        echo json_encode(['error' => 'Message must be 500 characters or less']);
        exit;
    }

    // Insert announcement as a notification for all users
    $usersQuery = "SELECT id FROM users WHERE id != ?";
    $stmt = $conn->prepare($usersQuery);
    $stmt->bind_param("i", $currentUserId);
    $stmt->execute();
    $usersResult = $stmt->get_result();

    $insertQuery = "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'info')";
    $insertStmt = $conn->prepare($insertQuery);
    
    $success = true;
    $title = $currentUserName; // Use admin's name as title
    
    while ($user = $usersResult->fetch_assoc()) {
        $insertStmt->bind_param("iss", $user['id'], $title, $message);
        if (!$insertStmt->execute()) {
            $success = false;
            break;
        }
    }

    $stmt->close();
    $insertStmt->close();

    if ($success) {
        echo json_encode([
            'success' => true,
            'message' => 'Announcement sent successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to send announcement']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
$conn->close();
?>
