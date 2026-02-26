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
$currentPassword = $input['currentPassword'] ?? '';
$newPassword = $input['newPassword'] ?? '';

if (empty($currentPassword) || empty($newPassword)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Current password and new password are required']);
    exit;
}

// Validate new password length
if (strlen($newPassword) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'New password must be at least 6 characters']);
    exit;
}

$email = $_SESSION['user_email'];

// Get current password hash from database
$stmt = $conn->prepare("SELECT password FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if (!$user) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'User not found']);
    exit;
}

// Verify current password
if (!password_verify($currentPassword, $user['password'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Current password is incorrect']);
    exit;
}

// Check if new password is same as current
if (password_verify($newPassword, $user['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'New password must be different from current password']);
    exit;
}

// Hash new password
$newPasswordHash = password_hash($newPassword, PASSWORD_BCRYPT);

// Update password
$stmt = $conn->prepare("UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?");
$stmt->bind_param('ss', $newPasswordHash, $email);

if ($stmt->execute()) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Password changed successfully'
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to update password: ' . $conn->error]);
}

$stmt->close();
$conn->close();
?>
