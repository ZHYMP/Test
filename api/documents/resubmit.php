<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once '../../session_helper.php';
require_once '../../database.php';

if (!$conn) {
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// Validate user session and get user info
$user = requireAuth(true);
$userId = $user['id'];

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

// Validate required fields
if (!isset($_FILES['file']) || !isset($_POST['documentId'])) {
    echo json_encode(['success' => false, 'error' => 'Missing required fields (file and documentId)']);
    exit;
}

$documentId = intval($_POST['documentId']);

// Verify document exists and user owns it
$docStmt = $conn->prepare("SELECT id, name, file_path, owner_id FROM files WHERE id = ?");
$docStmt->bind_param("i", $documentId);
$docStmt->execute();
$docResult = $docStmt->get_result();
$document = $docResult->fetch_assoc();
$docStmt->close();

if (!$document) {
    echo json_encode(['success' => false, 'error' => 'Document not found']);
    exit;
}

// Employees can only resubmit their own documents
if ($user['role'] === 'employee' && $document['owner_id'] !== $userId) {
    echo json_encode(['success' => false, 'error' => 'You can only resubmit your own documents']);
    exit;
}

// Handle file upload
$file = $_FILES['file'];
$uploadDir = '../../uploads/';

// Create uploads directory if it doesn't exist
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$fileName = basename($file['name']);
$fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
$allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg'];

// Validate file extension
if (!in_array($fileExtension, $allowedExtensions)) {
    echo json_encode(['success' => false, 'error' => 'Invalid file type']);
    exit;
}

// Validate file size (10MB max)
$maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
if ($file['size'] > $maxFileSize) {
    echo json_encode(['success' => false, 'error' => 'File size exceeds 10MB limit']);
    exit;
}

// Generate unique filename
$uniqueFileName = uniqid() . '_' . $fileName;
$newUploadPath = $uploadDir . $uniqueFileName;
$dbFilePath = 'uploads/' . $uniqueFileName;

// Move uploaded file
if (!move_uploaded_file($file['tmp_name'], $newUploadPath)) {
    echo json_encode(['success' => false, 'error' => 'Failed to upload file']);
    exit;
}

// Begin transaction
$conn->begin_transaction();

try {
    // Update document in database
    $fileSize = round($file['size'] / 1024, 2) . ' KB';
    $updateStmt = $conn->prepare("
        UPDATE files 
        SET file_path = ?, 
            file_type = ?, 
            file_size = ?, 
            status = 'in-progress', 
            modified_at = NOW() 
        WHERE id = ?
    ");
    $updateStmt->bind_param("sssi", $dbFilePath, $fileExtension, $fileSize, $documentId);
    
    if (!$updateStmt->execute()) {
        throw new Exception('Failed to update document');
    }
    $updateStmt->close();
    
    // Insert activity log
    $description = "Document resubmitted: " . $document['name'];
    $activityStmt = $conn->prepare(
        "INSERT INTO recent_activities (user_id, file_id, action, description, created_at) 
         VALUES (?, ?, 'uploaded', ?, NOW())"
    );
    $activityStmt->bind_param("iis", $userId, $documentId, $description);
    
    if (!$activityStmt->execute()) {
        throw new Exception('Failed to log activity');
    }
    $activityStmt->close();
    
    // Delete old file if it exists
    if (!empty($document['file_path']) && file_exists($document['file_path'])) {
        unlink($document['file_path']);
    }
    
    // Commit transaction
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Document resubmitted successfully'
    ]);
    
} catch (Exception $e) {
    // Rollback transaction on error
    $conn->rollback();
    
    // Delete newly uploaded file if database update fails
    if (file_exists($newUploadPath)) {
        unlink($newUploadPath);
    }
    
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

$conn->close();
?>
