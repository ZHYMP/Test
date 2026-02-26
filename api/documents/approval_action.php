<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

include '../../database.php';

if (!$conn) {
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// Check if user is logged in and is admin
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
$userStmt->close();

if (!$currentUser) {
    echo json_encode(['success' => false, 'error' => 'User not found']);
    exit;
}

if ($currentUser['role'] !== 'admin') {
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$documentId = isset($data['documentId']) ? intval($data['documentId']) : 0;
$action = isset($data['action']) ? $data['action'] : '';
$feedback = isset($data['feedback']) ? trim($data['feedback']) : '';

if (!$documentId || !$action) {
    echo json_encode(['success' => false, 'error' => 'Invalid request']);
    exit;
}

// Validate action
if (!in_array($action, ['approved', 'declined', 'return', 'comment'])) {
    echo json_encode(['success' => false, 'error' => 'Invalid action']);
    exit;
}

// Validate feedback for declined and return actions
if (($action === 'declined' || $action === 'return') && empty($feedback)) {
    $actionLabel = $action === 'declined' ? 'declining' : 'returning';
    echo json_encode(['success' => false, 'error' => "Feedback is required for {$actionLabel} documents"]);
    exit;
}

// Validate feedback for comment action
if ($action === 'comment' && empty($feedback)) {
    echo json_encode(['success' => false, 'error' => 'Comment text is required']);
    exit;
}

// Get document details
$docStmt = $conn->prepare("SELECT f.id, f.name, f.owner_id, f.status, u.name AS owner_name, u.email AS owner_email 
                           FROM files f 
                           LEFT JOIN users u ON f.owner_id = u.id 
                           WHERE f.id = ?");
$docStmt->bind_param("i", $documentId);
$docStmt->execute();
$docResult = $docStmt->get_result();
$document = $docResult->fetch_assoc();
$docStmt->close();

if (!$document) {
    echo json_encode(['success' => false, 'error' => 'Document not found']);
    exit;
}

// Handle comment-only action (doesn't change status)
if ($action === 'comment') {
    $conn->begin_transaction();
    
    try {
        // Insert comment
        $commentStmt = $conn->prepare(
            "INSERT INTO file_comments (file_id, user_id, message, action, created_at) 
             VALUES (?, ?, ?, 'comment', NOW())"
        );
        $commentStmt->bind_param("iis", $documentId, $currentUser['id'], $feedback);
        
        if (!$commentStmt->execute()) {
            throw new Exception('Failed to save comment');
        }
        $commentStmt->close();
        
        // Insert activity log
        $description = $currentUser['name'] . " commented on document: " . $document['name'];
        $activityStmt = $conn->prepare(
            "INSERT INTO recent_activities (user_id, file_id, action, description, created_at) 
             VALUES (?, ?, 'commented', ?, NOW())"
        );
        $activityStmt->bind_param("iis", $currentUser['id'], $documentId, $description);
        $activityStmt->execute();
        $activityStmt->close();
        
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Comment added successfully!'
        ]);
        exit;
        
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
        exit;
    }
}

// Map action to status
$statusMap = [
    'approved' => 'approved',
    'declined' => 'declined',
    'return' => 'review'
];

$newStatus = $statusMap[$action];

// Begin transaction
$conn->begin_transaction();

try {
    // Update document status
    $updateStmt = $conn->prepare("UPDATE files SET status = ?, modified_at = NOW() WHERE id = ?");
    $updateStmt->bind_param("si", $newStatus, $documentId);
    
    if (!$updateStmt->execute()) {
        throw new Exception('Failed to update document status');
    }
    $updateStmt->close();

    // Insert activity log
    $activityAction = $action === 'return' ? 'commented' : $action;
    $description = $currentUser['name'] . " " . $action . " document: " . $document['name'];
    
    $activityStmt = $conn->prepare(
        "INSERT INTO recent_activities (user_id, file_id, action, description, created_at) 
         VALUES (?, ?, ?, ?, NOW())"
    );
    $activityStmt->bind_param("iiss", $currentUser['id'], $documentId, $activityAction, $description);
    
    if (!$activityStmt->execute()) {
        throw new Exception('Failed to log activity');
    }
    $activityStmt->close();

    // Insert feedback as comment
    if (!empty($feedback)) {
        $commentAction = $action === 'approved' ? 'approved' : ($action === 'declined' ? 'rejected' : 'feedback');
        $commentStmt = $conn->prepare(
            "INSERT INTO file_comments (file_id, user_id, message, action, created_at) 
             VALUES (?, ?, ?, ?, NOW())"
        );
        $commentStmt->bind_param("iiss", $documentId, $currentUser['id'], $feedback, $commentAction);
        
        if (!$commentStmt->execute()) {
            throw new Exception('Failed to save feedback');
        }
        $commentStmt->close();
    }

    // Send notification to document owner
    if ($document['owner_id']) {
        $notificationMessages = [
            'approved' => "Document Approved: '{$document['name']}' has been approved by {$currentUser['name']}.",
            'declined' => "Document Declined: '{$document['name']}' has been declined by {$currentUser['name']}." . (!empty($feedback) ? " Reason: {$feedback}" : ""),
            'return' => "Document Returned: '{$document['name']}' has been returned for review by {$currentUser['name']}." . (!empty($feedback) ? " Feedback: {$feedback}" : "")
        ];
        
        $notificationMessage = $notificationMessages[$action];

        // Create notification entry
        $notifTypes = [
            'approved' => 'success',
            'declined' => 'error',
            'return' => 'warning'
        ];
        
        $notifTitles = [
            'approved' => 'Document Approved',
            'declined' => 'Document Declined',
            'return' => 'Document Returned'
        ];
        
        $notificationType = $notifTypes[$action];
        $notificationTitle = $notifTitles[$action];
        
        $notifStmt = $conn->prepare(
            "INSERT INTO notifications (user_id, title, message, type, related_file_id, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())"
        );
        $notifStmt->bind_param("isssi", $document['owner_id'], $notificationTitle, $notificationMessage, $notificationType, $documentId);
        
        if (!$notifStmt->execute()) {
            throw new Exception('Failed to create notification');
        }
        $notifStmt->close();
    }

    // Commit transaction
    $conn->commit();

    $responseMessages = [
        'approved' => 'Document approved successfully!',
        'declined' => 'Document declined successfully!',
        'return' => 'Document returned for review!'
    ];

    echo json_encode([
        'success' => true,
        'message' => $responseMessages[$action],
        'newStatus' => $newStatus,
        'action' => $action
    ]);

} catch (Exception $e) {
    // Rollback transaction on error
    $conn->rollback();
    
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

$conn->close();
?>
