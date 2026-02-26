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

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

// Ensure user is logged in
if (!isset($_SESSION['user_email'])) {
    respond(401, ['error' => 'Unauthorized']);
}

// Fetch current user and enforce admin-only access
$authStmt = $conn->prepare("SELECT id, role FROM users WHERE email = ?");
$authStmt->bind_param("s", $_SESSION['user_email']);
$authStmt->execute();
$authResult = $authStmt->get_result();
$currentUser = $authResult->fetch_assoc();

if (!$currentUser) {
    respond(401, ['error' => 'Unauthorized']);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && $currentUser['role'] !== 'admin') {
    $result = $conn->query(
        "SELECT id, name, username, role, department,
                DATE_FORMAT(created_at, '%Y-%m-%d') AS dateCreated
         FROM users
         ORDER BY created_at DESC"
    );

    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    respond(200, $users);
}

if ($currentUser['role'] !== 'admin') {
    respond(403, ['error' => 'Forbidden: admin access required']);
}

function getUserById(mysqli $conn, int $id): ?array
{
    $stmt = $conn->prepare(
        "SELECT id, name, username, email, role, department, is_signatory AS isSignatory, 
                DATE_FORMAT(created_at, '%Y-%m-%d') AS dateCreated
         FROM users WHERE id = ?"
    );
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    if ($user) {
        $user['isSignatory'] = (bool)$user['isSignatory'];
    }
    return $user ?: null;
}

if ($method === 'GET') {
    $result = $conn->query(
        "SELECT id, name, username, email, role, department, is_signatory AS isSignatory,
                DATE_FORMAT(created_at, '%Y-%m-%d') AS dateCreated
         FROM users
         ORDER BY created_at DESC"
    );

    $users = [];
    while ($row = $result->fetch_assoc()) {
        $row['isSignatory'] = (bool)$row['isSignatory'];
        $users[] = $row;
    }

    respond(200, $users);
}

$payload = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'POST') {
    $name = trim($payload['name'] ?? '');
    $username = trim($payload['username'] ?? '');
    $email = trim($payload['email'] ?? '');
    $password = $payload['password'] ?? '';
    $department = trim($payload['department'] ?? '');
    $role = strtolower(trim($payload['role'] ?? 'employee'));
    $isSignatory = !empty($payload['isSignatory']) ? 1 : 0;

    if (!$name || !$username || !$email || !$password) {
        respond(400, ['error' => 'Name, username, email, and password are required']);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(400, ['error' => 'Invalid email address']);
    }

    if (!in_array($role, ['admin', 'employee'], true)) {
        $role = 'employee';
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $conn->prepare(
        "INSERT INTO users (name, username, email, password, role, department, is_signatory) 
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param("ssssssi", $name, $username, $email, $passwordHash, $role, $department, $isSignatory);

    if (!$stmt->execute()) {
        if ($conn->errno === 1062) {
            respond(409, ['error' => 'Email or username already exists']);
        }
        respond(500, ['error' => 'Failed to create user']);
    }

    $newUser = getUserById($conn, $stmt->insert_id);
    respond(201, ['success' => true, 'user' => $newUser]);
}

if ($method === 'PUT') {
    $userId = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($userId <= 0) {
        respond(400, ['error' => 'User id is required']);
    }

    $fields = [];
    $params = [];
    $types = '';

    if (isset($payload['name'])) {
        $name = trim($payload['name']);
        if ($name === '') {
            respond(400, ['error' => 'Name cannot be empty']);
        }
        $fields[] = 'name = ?';
        $params[] = $name;
        $types .= 's';
    }

    if (isset($payload['username'])) {
        $username = trim($payload['username']);
        if ($username === '') {
            respond(400, ['error' => 'Username cannot be empty']);
        }
        $fields[] = 'username = ?';
        $params[] = $username;
        $types .= 's';
    }

    if (isset($payload['email'])) {
        $email = trim($payload['email']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(400, ['error' => 'Invalid email address']);
        }
        $fields[] = 'email = ?';
        $params[] = $email;
        $types .= 's';
    }

    if (isset($payload['department'])) {
        $fields[] = 'department = ?';
        $params[] = trim($payload['department']);
        $types .= 's';
    }

    if (isset($payload['role'])) {
        $role = strtolower(trim($payload['role']));
        if (!in_array($role, ['admin', 'employee'], true)) {
            respond(400, ['error' => 'Invalid role']);
        }
        $fields[] = 'role = ?';
        $params[] = $role;
        $types .= 's';
    }

    if (array_key_exists('isSignatory', $payload)) {
        $fields[] = 'is_signatory = ?';
        $params[] = !empty($payload['isSignatory']) ? 1 : 0;
        $types .= 'i';
    }

    if (isset($payload['password']) && $payload['password'] !== '') {
        $fields[] = 'password = ?';
        $params[] = password_hash($payload['password'], PASSWORD_BCRYPT);
        $types .= 's';
    }

    if (empty($fields)) {
        respond(400, ['error' => 'No fields to update']);
    }

    $query = 'UPDATE users SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = ?';
    $params[] = $userId;
    $types .= 'i';

    $stmt = $conn->prepare($query);
    $stmt->bind_param($types, ...$params);

    if (!$stmt->execute()) {
        if ($conn->errno === 1062) {
            respond(409, ['error' => 'Email or username already exists']);
        }
        respond(500, ['error' => 'Failed to update user']);
    }

    $updatedUser = getUserById($conn, $userId);
    if (!$updatedUser) {
        respond(404, ['error' => 'User not found']);
    }

    respond(200, ['success' => true, 'user' => $updatedUser]);
}

if ($method === 'DELETE') {
    $userId = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($userId <= 0) {
        respond(400, ['error' => 'User id is required']);
    }

    if ($userId === (int)$currentUser['id']) {
        respond(400, ['error' => 'You cannot delete your own account']);
    }

    $stmt = $conn->prepare('DELETE FROM users WHERE id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        respond(404, ['error' => 'User not found']);
    }

    respond(200, ['success' => true]);
}

respond(405, ['error' => 'Method not allowed']);
