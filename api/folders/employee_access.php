<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

include '../../database.php';

if (!$conn) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Check if user is logged in
if (!isset($_SESSION['user_email'])) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Get user id and role
$userStmt = $conn->prepare("SELECT id, role FROM users WHERE email = ? LIMIT 1");
$userStmt->bind_param("s", $_SESSION['user_email']);
$userStmt->execute();
$userResult = $userStmt->get_result();
$user = $userResult->fetch_assoc();
$userStmt->close();

if (!$user) {
    echo json_encode(['error' => 'User not found']);
    exit;
}

// Only employees can use this endpoint
if ($user['role'] !== 'employee') {
    echo json_encode(['error' => 'Access denied. This endpoint is for employees only.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Get folders the employee has access to
    $userId = (int)$user['id'];
    
    $query = "
        SELECT DISTINCT
            f.id,
            f.name,
            f.parent_id AS parentId,
            f.is_active AS active,
            f.created_by AS createdBy,
            u.name AS createdByName,
            f.created_at AS createdAt,
            f.updated_at AS updatedAt,
            COUNT(DISTINCT files.id) AS fileCount
        FROM folders f
        LEFT JOIN users u ON f.created_by = u.id
        LEFT JOIN files ON files.folder_id = f.id
        INNER JOIN folder_permissions fp ON f.id = fp.folder_id
        WHERE f.is_active = 1 
        AND fp.user_id = ?
        GROUP BY f.id
        ORDER BY f.name ASC
    ";
    
    $stmt = $conn->prepare($query);
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $folders = [];
    while ($row = $result->fetch_assoc()) {
        $row['active'] = (bool)$row['active'];
        $folders[] = $row;
    }
    
    $stmt->close();
    
    echo json_encode(['success' => true, 'folders' => $folders]);
    exit;
}

if ($method === 'POST') {
    // Get JSON data
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['action'])) {
        echo json_encode(['error' => 'Action is required']);
        exit;
    }
    
    $action = $data['action'];
    
    if ($action === 'get_folder_files') {
        // Get files in a folder the employee has access to
        if (!isset($data['folderId'])) {
            echo json_encode(['error' => 'folderId is required']);
            exit;
        }
        
        $folderId = (int)$data['folderId'];
        $userId = (int)$user['id'];
        
        // First, verify employee has access to this folder
        $permissionCheck = $conn->prepare("
            SELECT COUNT(*) as hasAccess 
            FROM folder_permissions 
            WHERE folder_id = ? AND user_id = ?
        ");
        $permissionCheck->bind_param("ii", $folderId, $userId);
        $permissionCheck->execute();
        $permResult = $permissionCheck->get_result();
        $permRow = $permResult->fetch_assoc();
        $permissionCheck->close();
        
        if ($permRow['hasAccess'] == 0) {
            echo json_encode(['error' => 'Access denied to this folder']);
            exit;
        }
        
        // Get files in the folder
        $query = "
            SELECT 
                files.id,
                files.name,
                files.file_path AS filePath,
                files.file_type AS type,
                files.file_size AS size,
                files.owner_id AS uploadedBy,
                u.name AS uploadedByName,
                files.uploaded_at AS uploadedAt,
                files.folder_id AS folderId
            FROM files
            LEFT JOIN users u ON files.owner_id = u.id
            WHERE files.folder_id = ?
            ORDER BY files.uploaded_at DESC
        ";
        
        $stmt = $conn->prepare($query);
        $stmt->bind_param("i", $folderId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $files = [];
        while ($row = $result->fetch_assoc()) {
            $files[] = $row;
        }
        
        $stmt->close();
        
        echo json_encode(['success' => true, 'files' => $files]);
        exit;
    }
}

echo json_encode(['error' => 'Invalid request']);
?>
