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

// Get logged-in user info
$email = $_SESSION['user_email'];
$userStmt = $conn->prepare("SELECT id, name, role FROM users WHERE email = ?");
$userStmt->bind_param("s", $email);
$userStmt->execute();
$userResult = $userStmt->get_result();
$currentUser = $userResult->fetch_assoc();

if (!$currentUser) {
    echo json_encode(['success' => false, 'error' => 'User not found']);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$documentId = isset($data['documentId']) ? intval($data['documentId']) : 0;
$action = isset($data['action']) ? $data['action'] : '';
$comment = isset($data['comment']) ? $data['comment'] : '';

// Handle update action
if ($action === 'update') {
    $title = isset($data['title']) ? trim($data['title']) : '';
    $dueDate = isset($data['dueDate']) && $data['dueDate'] !== '' ? $data['dueDate'] : null;
    $requiresSignature = isset($data['requiresSignature']) ? intval($data['requiresSignature']) : 0;
    $signatories = [];
    if (isset($data['signatories']) && is_array($data['signatories'])) {
        $signatories = array_values(array_filter($data['signatories'], function ($id) {
            return is_numeric($id);
        }));
    }

    if ($title === '') {
        echo json_encode(['success' => false, 'error' => 'Title is required']);
        exit;
    }

    if ($requiresSignature && count($signatories) === 0) {
        echo json_encode(['success' => false, 'error' => 'Please select at least one signatory']);
        exit;
    }

    $updateStmt = $conn->prepare(
        "UPDATE files SET name = ?, due_date = ?, requires_signature = ?, modified_at = NOW() WHERE id = ?"
    );
    $updateStmt->bind_param("ssii", $title, $dueDate, $requiresSignature, $documentId);

    if (!$updateStmt->execute()) {
        echo json_encode(['success' => false, 'error' => 'Failed to update document']);
        exit;
    }

    // Sync signatories
    $deleteStmt = $conn->prepare("DELETE FROM file_signatories WHERE file_id = ?");
    $deleteStmt->bind_param("i", $documentId);
    $deleteStmt->execute();
    $deleteStmt->close();

    if ($requiresSignature && count($signatories) > 0) {
        // Remove duplicates from signatories array
        $signatories = array_unique($signatories);
        
        $sigStmt = $conn->prepare(
            "INSERT IGNORE INTO file_signatories (file_id, user_id, signed) VALUES (?, ?, 0)"
        );
        foreach ($signatories as $signatoryId) {
            $signatoryId = intval($signatoryId);
            if ($signatoryId > 0) { // Validate it's a valid user ID
                $sigStmt->bind_param("ii", $documentId, $signatoryId);
                $sigStmt->execute();
            }
        }
        $sigStmt->close();
    }

    $activityStmt = $conn->prepare(
        "INSERT INTO recent_activities (user_id, file_id, action, description) VALUES (?, ?, 'modified', ?)"
    );
    $description = $currentUser['name'] . " modified document " . $title;
    $activityStmt->bind_param("iis", $currentUser['id'], $documentId, $description);
    $activityStmt->execute();

    echo json_encode([
        'success' => true,
        'message' => 'Document updated successfully'
    ]);
    exit;
}

// Handle delete action
if ($action === 'delete') {
    $docStmt = $conn->prepare("SELECT name FROM files WHERE id = ?");
    $docStmt->bind_param("i", $documentId);
    $docStmt->execute();
    $docResult = $docStmt->get_result();
    $document = $docResult->fetch_assoc();

    $activityStmt = $conn->prepare(
        "INSERT INTO recent_activities (user_id, file_id, action, description) VALUES (?, ?, 'deleted', ?)"
    );
    $description = $currentUser['name'] . " deleted document " . ($document['name'] ?? 'document');
    $activityStmt->bind_param("iis", $currentUser['id'], $documentId, $description);
    $activityStmt->execute();

    $deleteStmt = $conn->prepare("DELETE FROM files WHERE id = ?");
    $deleteStmt->bind_param("i", $documentId);

    if (!$deleteStmt->execute()) {
        echo json_encode(['success' => false, 'error' => 'Failed to delete document']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Document deleted successfully'
    ]);
    exit;
}

if (!$documentId || !$action) {
    echo json_encode(['success' => false, 'error' => 'Invalid request']);
    exit;
}

// Map action to status
$statusMap = [
    'approved' => 'approved',
    'reject' => 'rejected',
    'return' => 'review'
];

$newStatus = $statusMap[$action] ?? 'pending';

// Update document status
$updateStmt = $conn->prepare("UPDATE files SET status = ?, modified_at = NOW() WHERE id = ?");
$updateStmt->bind_param("si", $newStatus, $documentId);

if (!$updateStmt->execute()) {
    echo json_encode(['success' => false, 'error' => 'Failed to update document status']);
    exit;
}

// Get document details for activity log
$docStmt = $conn->prepare("SELECT name FROM files WHERE id = ?");
$docStmt->bind_param("i", $documentId);
$docStmt->execute();
$docResult = $docStmt->get_result();
$document = $docResult->fetch_assoc();

// Insert activity log
$activityAction = $action === 'return' ? 'commented' : $action;
$description = $currentUser['name'] . " " . $action . " " . ($document['name'] ?? 'document');

$activityStmt = $conn->prepare(
    "INSERT INTO recent_activities (user_id, file_id, action, description) VALUES (?, ?, ?, ?)"
);
$activityStmt->bind_param("iiss", $currentUser['id'], $documentId, $activityAction, $description);
$activityStmt->execute();

// Insert comment if provided
if (!empty($comment)) {
    $commentAction = $action === 'approved' ? 'approved' : ($action === 'reject' ? 'rejected' : 'feedback');
    $commentStmt = $conn->prepare(
        "INSERT INTO file_comments (file_id, user_id, message, action) VALUES (?, ?, ?, ?)"
    );
    $commentStmt->bind_param("iiss", $documentId, $currentUser['id'], $comment, $commentAction);
    $commentStmt->execute();
}

echo json_encode([
    'success' => true,
    'message' => 'Document ' . $action . ' successfully',
    'newStatus' => $newStatus
]);
?>
