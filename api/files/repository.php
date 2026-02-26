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

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Get all files for file repository (including admin files)
    $query = "
        SELECT 
            f.id,
            f.name AS fileName,
            f.file_path AS filePath,
            f.file_type AS type,
            f.file_size AS size,
            f.status,
            f.folder_id AS folderId,
            u.name AS owner,
            u.id AS ownerId,
            u.department,
            u.email AS ownerEmail,
            DATE_FORMAT(f.uploaded_at, '%b %d, %Y') AS dateUploaded,
            DATE_FORMAT(f.modified_at, '%b %d, %Y') AS modifiedDate,
            f.requires_signature AS requiresSignature,
            f.due_date AS dueDate
        FROM files f
        LEFT JOIN users u ON f.owner_id = u.id
        ORDER BY f.uploaded_at DESC
        LIMIT 50
    ";
    
    $result = $conn->query($query);
    
    if (!$result) {
        echo json_encode(['error' => $conn->error]);
        exit;
    }
    
    $files = [];
    while ($row = $result->fetch_assoc()) {
        $row['requiresSignature'] = (bool)$row['requiresSignature'];
        $files[] = $row;
    }
    
    echo json_encode(['success' => true, 'files' => $files]);
    exit;
}

if ($method === 'POST') {
    // Add file to folder or create new file
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['fileName']) || empty($data['fileName'])) {
        echo json_encode(['error' => 'File name is required']);
        exit;
    }
    
    $fileName = $data['fileName'];
    $fileType = $data['fileType'] ?? 'other';
    $fileSize = $data['fileSize'] ?? '0 B';
    $folderId = isset($data['folderId']) ? (int)$data['folderId'] : null;
    $filePath = $data['filePath'] ?? '';
    $originalName = $data['originalName'] ?? $fileName;
    $department = $data['department'] ?? null;
    
    $stmt = $conn->prepare("
        INSERT INTO files (name, original_name, file_path, file_type, file_size, folder_id, owner_id, department, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    ");
    
    $stmt->bind_param("ssssssss", $fileName, $originalName, $filePath, $fileType, $fileSize, $folderId, $user['id'], $department);
    
    if ($stmt->execute()) {
        $fileId = $stmt->insert_id;
        echo json_encode([
            'success' => true,
            'message' => 'File added successfully',
            'file' => [
                'id' => $fileId,
                'fileName' => $fileName,
                'type' => $fileType,
                'size' => $fileSize,
                'folderId' => $folderId,
                'owner' => $_SESSION['user_email'],
                'status' => 'pending'
            ]
        ]);
    } else {
        echo json_encode(['error' => 'Failed to add file: ' . $stmt->error]);
    }
    
    $stmt->close();
    exit;
}

echo json_encode(['error' => 'Invalid request method']);
?>
