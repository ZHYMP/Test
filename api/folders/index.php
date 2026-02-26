<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

require_once '../../session_helper.php';
require_once '../../database.php';

if (!$conn) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Validate user session and get user info
$user = requireAuth(true);

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Get all folders with active status
    $query = "
        SELECT 
            f.id,
            f.name,
            f.parent_id AS parentId,
            f.is_active AS active,
            f.created_by AS createdBy,
            u.name AS createdByName,
            f.created_at AS createdAt,
            f.updated_at AS updatedAt,
            COUNT(files.id) AS fileCount
        FROM folders f
        LEFT JOIN users u ON f.created_by = u.id
        LEFT JOIN files ON files.folder_id = f.id
        WHERE f.is_active = 1
        GROUP BY f.id
        ORDER BY f.name ASC
    ";
    
    $result = $conn->query($query);
    
    if (!$result) {
        echo json_encode(['error' => $conn->error]);
        exit;
    }
    
    $folders = [];
    while ($row = $result->fetch_assoc()) {
        $row['active'] = (bool)$row['active'];
        $folders[] = $row;
    }
    
    echo json_encode(['success' => true, 'folders' => $folders]);
    exit;
}

if ($method === 'POST') {
    // Get JSON data
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Check action
    $action = isset($data['action']) ? $data['action'] : 'create';
    
    if ($action === 'update') {
        // Update folder
        if (!isset($data['id']) || !isset($data['name'])) {
            echo json_encode(['error' => 'Folder ID and name are required']);
            exit;
        }
        
        $stmt = $conn->prepare("UPDATE folders SET name = ? WHERE id = ?");
        $stmt->bind_param("si", $data['name'], $data['id']);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Folder updated']);
        } else {
            echo json_encode(['error' => 'Failed to update folder']);
        }
        
        $stmt->close();
        exit;
    }
    
    if ($action === 'delete') {
        // Delete folder (soft delete)
        if (!isset($data['id'])) {
            echo json_encode(['error' => 'Folder ID is required']);
            exit;
        }
        
        $stmt = $conn->prepare("UPDATE folders SET is_active = 0 WHERE id = ?");
        $stmt->bind_param("i", $data['id']);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Folder deleted']);
        } else {
            echo json_encode(['error' => 'Failed to delete folder']);
        }
        
        $stmt->close();
        exit;
    }
    
    // Create new folder
    if (!isset($data['name']) || empty(trim($data['name']))) {
        echo json_encode(['error' => 'Folder name is required']);
        exit;
    }
    
    $name = trim($data['name']);
    $parentId = isset($data['parentId']) && $data['parentId'] ? $data['parentId'] : null;
    $createdBy = $user['id'];
    
    $stmt = $conn->prepare("
        INSERT INTO folders (name, parent_id, created_by, is_active)
        VALUES (?, ?, ?, 1)
    ");
    
    $stmt->bind_param("sii", $name, $parentId, $createdBy);
    
    if ($stmt->execute()) {
        $folderId = $stmt->insert_id;
        echo json_encode([
            'success' => true,
            'message' => 'Folder created successfully',
            'folder' => [
                'id' => $folderId,
                'name' => $name,
                'parentId' => $parentId,
                'active' => true,
                'createdBy' => $createdBy,
                'createdByName' => $_SESSION['user_email'],
                'fileCount' => 0
            ]
        ]);
    } else {
        echo json_encode(['error' => 'Failed to create folder: ' . $stmt->error]);
    }
    
    $stmt->close();
    exit;
}

echo json_encode(['error' => 'Invalid request method']);
?>
