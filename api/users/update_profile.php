<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

require '../../database.php';

// Check database connection
if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// Check authentication
if (!isset($_SESSION['user_email'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
    exit;
}

// Validate required fields
$name = trim($input['name'] ?? '');
$username = trim($input['username'] ?? '');
$email = trim($input['email'] ?? '');
$department = trim($input['department'] ?? '');

if (empty($name) || empty($username) || empty($email)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Name, username, and email are required']);
    exit;
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid email format']);
    exit;
}

$currentEmail = $_SESSION['user_email'];

// Check if new email/username is already taken by another user
if ($email !== $currentEmail) {
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? AND email != ?");
    $stmt->bind_param('ss', $email, $currentEmail);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Email already in use']);
        exit;
    }
}

// Check if username is taken by another user
$stmt = $conn->prepare("SELECT id FROM users WHERE username = ? AND email != ?");
$stmt->bind_param('ss', $username, $currentEmail);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    http_response_code(409);
    echo json_encode(['success' => false, 'error' => 'Username already in use']);
    exit;
}

// Update user profile
// Department is optional (only admins can update their department)
if (isset($input['department'])) {
    $stmt = $conn->prepare("UPDATE users SET name = ?, username = ?, email = ?, department = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?");
    $stmt->bind_param('sssss', $name, $username, $email, $department, $currentEmail);
} else {
    $stmt = $conn->prepare("UPDATE users SET name = ?, username = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?");
    $stmt->bind_param('ssss', $name, $username, $email, $currentEmail);
}

if ($stmt->execute()) {
    // Update session email if it was changed
    if ($email !== $currentEmail) {
        $_SESSION['user_email'] = $email;
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Profile updated successfully',
        'data' => [
            'name' => $name,
            'username' => $username,
            'email' => $email,
            'department' => $department
        ]
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to update profile: ' . $conn->error]);
}

$stmt->close();
$conn->close();
?>
