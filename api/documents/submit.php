<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors in output
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

// Debug logging - Log user info for troubleshooting
error_log("[SUBMIT DEBUG] User from session: " . json_encode($user));
error_log("[SUBMIT DEBUG] User ID to be used: " . $userId);
error_log("[SUBMIT DEBUG] Session data: " . json_encode([
    'user_id' => $_SESSION['user_id'] ?? 'NOT SET',
    'user_email' => $_SESSION['user_email'] ?? 'NOT SET',
    'user_name' => $_SESSION['user_name'] ?? 'NOT SET',
    'user_role' => $_SESSION['user_role'] ?? 'NOT SET'
]));

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

// Validate required fields
if (!isset($_FILES['file']) || !isset($_POST['title']) || !isset($_POST['department'])) {
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
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

// Generate unique filename to prevent overwrites
$uniqueFileName = uniqid() . '_' . $fileName;
$uploadPath = $uploadDir . $uniqueFileName;
$dbFilePath = 'uploads/' . $uniqueFileName;

// Move uploaded file
if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
    echo json_encode(['success' => false, 'error' => 'Failed to upload file']);
    exit;
}

// Get form data
$title = trim($_POST['title']);
$department = $_POST['department'];
$dueDate = isset($_POST['dueDate']) && !empty($_POST['dueDate']) ? $_POST['dueDate'] : null;
$requiresSignature = isset($_POST['requiresSignature']) && $_POST['requiresSignature'] === '1' ? 1 : 0;
// Signatories list (JSON array of user IDs)
$signatories = [];
if (isset($_POST['signatories'])) {
    $decoded = json_decode($_POST['signatories'], true);
    if (is_array($decoded)) {
        $signatories = array_values(array_filter($decoded, function ($id) {
            return is_numeric($id);
        }));
    }
}

if ($requiresSignature && count($signatories) === 0) {
    echo json_encode(['success' => false, 'error' => 'Please select at least one signatory']);
    exit;
}

// Insert document into database
$stmt = $conn->prepare("
    INSERT INTO files (name, original_name, file_path, file_type, file_size, department, owner_id, status, due_date, requires_signature, uploaded_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())
");

$fileSize = round($file['size'] / 1024, 2) . ' KB'; // Convert to KB

// Debug log before insert
error_log("[SUBMIT DEBUG] Inserting document with owner_id: " . $userId . " (user: " . $user['name'] . ", email: " . $user['email'] . ")");

$stmt->bind_param("ssssssisi", $title, $fileName, $dbFilePath, $fileExtension, $fileSize, $department, $userId, $dueDate, $requiresSignature);

if ($stmt->execute()) {
    $fileId = $stmt->insert_id;
    
    // Debug verification - Check what was actually inserted
    $verifyStmt = $conn->prepare("SELECT owner_id, name FROM files WHERE id = ?");
    $verifyStmt->bind_param("i", $fileId);
    $verifyStmt->execute();
    $verifyResult = $verifyStmt->get_result()->fetch_assoc();
    $verifyStmt->close();
    
    error_log("[SUBMIT DEBUG] Document inserted with ID: " . $fileId . ", owner_id in DB: " . $verifyResult['owner_id']);
    
    $stmt->close();

    // Insert signatories if required
    if ($requiresSignature && $fileId && count($signatories) > 0) {
        // Remove duplicates from signatories array
        $signatories = array_unique($signatories);
        
        $sigStmt = $conn->prepare(
            "INSERT IGNORE INTO file_signatories (file_id, user_id, signed) VALUES (?, ?, 0)"
        );
        foreach ($signatories as $signatoryId) {
            $signatoryId = intval($signatoryId);
            if ($signatoryId > 0) { // Validate it's a valid user ID
                $sigStmt->bind_param("ii", $fileId, $signatoryId);
                $sigStmt->execute();
            }
        }
        $sigStmt->close();
        
        error_log("[SUBMIT DEBUG] Inserted " . count($signatories) . " unique signatories for file ID: " . $fileId);
    }
    
    // Insert activity log for document upload
    $description = "Document uploaded: " . $title;
    $activityStmt = $conn->prepare(
        "INSERT INTO recent_activities (user_id, file_id, action, description, created_at) 
         VALUES (?, ?, 'uploaded', ?, NOW())"
    );
    $activityStmt->bind_param("iis", $userId, $fileId, $description);
    $activityStmt->execute();
    $activityStmt->close();

    $conn->close();
    echo json_encode([
        'success' => true,
        'message' => 'Document submitted successfully'
    ]);
} else {
    $error = $stmt->error;
    $stmt->close();
    $conn->close();
    // Delete uploaded file if database insert fails
    if (file_exists($uploadPath)) {
        unlink($uploadPath);
    }
    echo json_encode(['success' => false, 'error' => 'Failed to save document: ' . $error]);
}
?>
