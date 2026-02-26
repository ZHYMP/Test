<?php
/**
 * File Preview Handler
 * 
 * Serves files for inline viewing (preview) instead of downloading
 * Verifies user permissions and serves files with Content-Disposition: inline
 */

require_once '../../session_config.php';
session_start();

// Helper function to return JSON error
function returnJsonError($statusCode, $message) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

// Check if user is logged in
if (!isset($_SESSION['user_email'])) {
    returnJsonError(401, "Unauthorized: Please log in to preview files");
}

require_once "../../database.php";

// Get file ID from query parameter
$fileId = intval($_GET['id'] ?? 0);

if ($fileId === 0) {
    returnJsonError(400, "Invalid file ID");
}

try {
    // Get user info
    $stmt = $conn->prepare("SELECT id, role, department FROM users WHERE email = ?");
    $stmt->bind_param("s", $_SESSION['user_email']);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$user) {
        returnJsonError(401, "User not found");
    }
    
    // Get file information (including modified_at for cache busting)
    $stmt = $conn->prepare("
        SELECT 
            f.name,
            f.original_name,
            f.file_path,
            f.file_type,
            f.file_size,
            f.folder_id,
            f.department,
            f.owner_id,
            f.modified_at,
            u.name AS owner_name
        FROM files f
        LEFT JOIN users u ON f.owner_id = u.id
        WHERE f.id = ?
    ");
    $stmt->bind_param("i", $fileId);
    $stmt->execute();
    $file = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$file) {
        returnJsonError(404, "File not found");
    }
    
    // Check permissions
    // Admin can view anything
    // Employee can view if:
    //   1. They are the owner, OR
    //   2. File is in a folder they have permission to access, OR
    //   3. File has no folder AND no department restriction (NULL), OR  
    //   4. File has no folder AND their department matches the file's department
    if ($user['role'] !== 'admin') {
        $isOwner = $file['owner_id'] === $user['id'];
        
        // Check folder-based permissions (primary method for file repository)
        $hasFolderAccess = false;
        if (!empty($file['folder_id'])) {
            $folderCheckStmt = $conn->prepare("
                SELECT COUNT(*) as has_access 
                FROM folder_permissions 
                WHERE folder_id = ? AND user_id = ?
            ");
            $folderCheckStmt->bind_param("ii", $file['folder_id'], $user['id']);
            $folderCheckStmt->execute();
            $folderResult = $folderCheckStmt->get_result();
            $folderRow = $folderResult->fetch_assoc();
            $folderCheckStmt->close();
            
            $hasFolderAccess = $folderRow['has_access'] > 0;
        }
        
        // Check department-based permissions (fallback for files not in folders)
        $hasNoDepartmentRestriction = empty($file['department']);
        $departmentsMatch = !empty($file['department']) && !empty($user['department']) && 
                           $file['department'] === $user['department'];
        
        // Allow view if any of the conditions are met
        if (!$isOwner && !$hasFolderAccess && !$hasNoDepartmentRestriction && !$departmentsMatch) {
            // Log permission check details for debugging
            error_log("Preview permission denied for user_id={$user['id']}, file_id={$fileId}: " .
                     "isOwner=$isOwner, hasFolderAccess=$hasFolderAccess, " .
                     "hasNoDepartmentRestriction=$hasNoDepartmentRestriction, departmentsMatch=$departmentsMatch");
            returnJsonError(403, "Access denied: You don't have permission to view this file");
        }
    }
    
    $filePath = __DIR__ . '/../../' . $file['file_path'];
    
    // Verify file exists
    if (!file_exists($filePath)) {
        returnJsonError(404, "File not found on server");
    }
    
    // Get file MIME type
    $mimeTypes = [
        'pdf' => 'application/pdf',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc' => 'application/msword',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls' => 'application/vnd.ms-excel',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'bmp' => 'image/bmp',
        'webp' => 'image/webp',
        'txt' => 'text/plain',
        'csv' => 'text/csv',
        'json' => 'application/json',
        'xml' => 'application/xml'
    ];
    
    $mimeType = $mimeTypes[$file['file_type']] ?? 'application/octet-stream';
    
    // Get file modification time for ETag and Last-Modified headers
    $fileModTime = filemtime($filePath);
    $lastModified = gmdate('D, d M Y H:i:s', $fileModTime) . ' GMT';
    $etag = md5($file['file_path'] . $fileModTime);
    
    // Check if client has cached version (ETagnoscript or If-Modified-Since)
    $clientEtag = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
    $clientModifiedSince = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? '';
    
    if (($clientEtag === $etag) || ($clientModifiedSince === $lastModified)) {
        // File hasn't changed, return 304 Not Modified
        http_response_code(304);
        exit;
    }
    
    // Set headers for inline viewing (preview) with proper caching
    header('Content-Type: ' . $mimeType);
    header('Content-Disposition: inline; filename="' . $file['original_name'] . '"');
    header('Content-Length: ' . filesize($filePath));
    header('Last-Modified: ' . $lastModified);
    header('ETag: ' . $etag);
    header('Cache-Control: private, max-age=60, must-revalidate'); // Cache for 1 minute, then revalidate
    header('Pragma: cache');
    header('Accept-Ranges: bytes');
    
    // For binary files that will be processed by JavaScript libraries
    if (in_array($file['file_type'], ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'])) {
        header('X-Content-Type-Options: nosniff');
    }
    
    // Clear output buffer
    if (ob_get_level()) {
        ob_clean();
    }
    flush();
    
    // Read and output file
    readfile($filePath);
    
    $conn->close();
    exit;
    
} catch (Exception $e) {
    returnJsonError(500, "Error previewing file: " . $e->getMessage());
}
?>
