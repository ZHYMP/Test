<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

require '../../database.php';

if (!$conn) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

if (!isset($_SESSION['user_email'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$email = $_SESSION['user_email'];
$stmt = $conn->prepare("SELECT id, name, username, email, role, department FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
}

echo json_encode([
    'id' => (int)$user['id'],
    'name' => $user['name'],
    'username' => $user['username'] ?? '',
    'email' => $user['email'],
    'role' => $user['role'],
    'department' => $user['department'] ?? ''
]);
?>
