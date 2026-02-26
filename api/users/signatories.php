<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

include '../../database.php';

if (!$conn) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

if (!isset($_SESSION['user_email'])) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$department = isset($_GET['department']) ? trim($_GET['department']) : '';

$query = "SELECT id, name, department, role FROM users WHERE is_signatory = 1";

$query .= " ORDER BY name ASC";

$stmt = $conn->prepare($query);
$stmt->execute();
$result = $stmt->get_result();

$users = [];
while ($row = $result->fetch_assoc()) {
    $users[] = $row;
}

echo json_encode($users);
?>
