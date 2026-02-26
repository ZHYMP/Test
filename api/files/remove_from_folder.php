<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

include '../../database.php';

if (!$conn) {
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// Check if user is logged in
if (!isset($_SESSION['user_email'])) {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid method']);
    exit;
}

// Get user ID and role
$userStmt = $conn->prepare("SELECT id, role FROM users WHERE email = ? LIMIT 1");
$userStmt->bind_param("s", $_SESSION['user_email']);
$userStmt->execute();
$userResult = $userStmt->get_result();
$user = $userResult->fetch_assoc();
$userStmt->close();

if (!$user) {
    echo json_encode(['success' => false, 'error' => 'User not found']);
    exit;
}

// Get posted data
$data = json_decode(file_get_contents('php://input'), true);
$fileId = isset($data['fileId']) ? (int)$data['fileId'] : null;

if (!$fileId) {
    echo json_encode(['success' => false, 'error' => 'File ID is required']);
    exit;
}

// Verify file exists
$fileStmt = $conn->prepare("SELECT id, name, folder_id FROM files WHERE id = ? LIMIT 1");
$fileStmt->bind_param("i", $fileId);
$fileStmt->execute();
$fileResult = $fileStmt->get_result();
$fileData = $fileResult->fetch_assoc();
$fileStmt->close();

if (!$fileData) {
    echo json_encode(['success' => false, 'error' => 'File not found']);
    exit;
}

// Remove file from folder (set folder_id to NULL)
$updateStmt = $conn->prepare("UPDATE files SET folder_id = NULL WHERE id = ?");
$updateStmt->bind_param("i", $fileId);

if ($updateStmt->execute()) {
    $updateStmt->close();
    $conn->close();
    
    echo json_encode([
        'success' => true,
        'message' => 'File removed from folder successfully',
        'fileId' => $fileId,
        'fileName' => $fileData['name']
    ]);
} else {
    $updateStmt->close();
    $conn->close();
    
    echo json_encode([
        'success' => false,
        'error' => 'Failed to remove file from folder'
    ]);
}
?>
