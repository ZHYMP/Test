<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

require_once '../../session_helper.php';
require_once '../../database.php';

if (!$conn) {
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// Validate user session and get user info
$user = requireAuth(true);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid method']);
    exit;
}

$folderId = isset($_POST['folderId']) ? (int)$_POST['folderId'] : null;
$existingFileIds = isset($_POST['existingFileIds']) ? json_decode($_POST['existingFileIds'], true) : [];

if (!$folderId) {
    echo json_encode(['success' => false, 'error' => 'Folder ID is required']);
    exit;
}

// Verify folder exists
$folderStmt = $conn->prepare("SELECT id FROM folders WHERE id = ? LIMIT 1");
$folderStmt->bind_param("i", $folderId);
$folderStmt->execute();
$folderExists = $folderStmt->get_result()->num_rows > 0;
$folderStmt->close();

if (!$folderExists) {
    echo json_encode(['success' => false, 'error' => 'Folder not found']);
    exit;
}

$addedFiles = [];
$uploadErrors = [];

// Handle file uploads
if (isset($_FILES['files']) && is_array($_FILES['files']['name'])) {
    $uploadDir = '../../uploads/';
    
    // Create upload directory if it doesn't exist
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $fileCount = count($_FILES['files']['name']);
    
    for ($i = 0; $i < $fileCount; $i++) {
        if ($_FILES['files']['error'][$i] === UPLOAD_ERR_OK) {
            $originalName = basename($_FILES['files']['name'][$i]);
            $tmpName = $_FILES['files']['tmp_name'][$i];
            $fileSize = $_FILES['files']['size'][$i];
            
            // Generate unique filename
            $extension = pathinfo($originalName, PATHINFO_EXTENSION);
            $nameWithoutExt = pathinfo($originalName, PATHINFO_FILENAME);
            $uniqueName = $nameWithoutExt . '_' . time() . '_' . uniqid() . '.' . $extension;
            $filePath = $uploadDir . $uniqueName;
            $dbFilePath = 'uploads/' . $uniqueName;
            
            // Determine file type based on extension
            $fileType = 'other';
            if (in_array(strtolower($extension), ['pdf'])) {
                $fileType = 'pdf';
            } elseif (in_array(strtolower($extension), ['doc', 'docx'])) {
                $fileType = 'docx';
            } elseif (in_array(strtolower($extension), ['xls', 'xlsx'])) {
                $fileType = 'xlsx';
            } elseif (in_array(strtolower($extension), ['jpg', 'jpeg', 'png', 'gif'])) {
                $fileType = 'image';
            }
            
            // Format file size
            $sizeFormatted = formatFileSize($fileSize);
            
            if (move_uploaded_file($tmpName, $filePath)) {
                // Insert file record into database
                $stmt = $conn->prepare("
                    INSERT INTO files (name, original_name, file_path, file_type, file_size, folder_id, owner_id, status, uploaded_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', NOW())
                ");
                
                $stmt->bind_param("sssssis", $uniqueName, $originalName, $dbFilePath, $fileType, $sizeFormatted, $folderId, $user['id']);
                
                if ($stmt->execute()) {
                    $addedFiles[] = [
                        'id' => $stmt->insert_id,
                        'name' => $originalName,
                        'type' => $fileType,
                        'size' => $sizeFormatted
                    ];
                } else {
                    $uploadErrors[] = "Database error for $originalName";
                    unlink($filePath); // Remove uploaded file
                }
                
                $stmt->close();
            } else {
                $uploadErrors[] = "Failed to upload $originalName";
            }
        } else {
            $uploadErrors[] = "Upload error for file #" . ($i + 1);
        }
    }
}

// Handle existing approved files - associate them with the folder
if (!empty($existingFileIds) && is_array($existingFileIds)) {
    foreach ($existingFileIds as $fileId) {
        $fileId = (int)$fileId;
        
        // Update the file's folder_id
        $updateStmt = $conn->prepare("UPDATE files SET folder_id = ? WHERE id = ? AND status = 'approved'");
        $updateStmt->bind_param("ii", $folderId, $fileId);
        
        if ($updateStmt->execute() && $updateStmt->affected_rows > 0) {
            // Get file details
            $fileStmt = $conn->prepare("SELECT name AS fileName, file_type AS type, file_size AS size FROM files WHERE id = ? LIMIT 1");
            $fileStmt->bind_param("i", $fileId);
            $fileStmt->execute();
            $fileResult = $fileStmt->get_result();
            $fileData = $fileResult->fetch_assoc();
            $fileStmt->close();
            
            if ($fileData) {
                $addedFiles[] = [
                    'id' => $fileId,
                    'name' => $fileData['fileName'],
                    'type' => $fileData['type'],
                    'size' => $fileData['size']
                ];
            }
        }
        
        $updateStmt->close();
    }
}

// Helper function to format file size
function formatFileSize($bytes) {
    if ($bytes >= 1073741824) {
        return number_format($bytes / 1073741824, 2) . ' GB';
    } elseif ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 2) . ' MB';
    } elseif ($bytes >= 1024) {
        return number_format($bytes / 1024, 2) . ' KB';
    } else {
        return $bytes . ' B';
    }
}

$conn->close();

// Return response
if (count($addedFiles) > 0) {
    echo json_encode([
        'success' => true,
        'message' => count($addedFiles) . ' file(s) added successfully',
        'addedFiles' => $addedFiles,
        'errors' => $uploadErrors
    ]);
} else {
    echo json_encode([
        'success' => false,
        'error' => 'No files were added',
        'errors' => $uploadErrors
    ]);
}
?>
