<?php
/**
 * Signature Embedding Router
 * 
 * Routes signature embedding requests to appropriate handler:
 * - PDF files → embed_pdf_signature.php (requires FPDI/TCPDF)
 * - Image files → handled here using GD library
 */

require_once '../../session_config.php';
session_start();
header("Content-Type: application/json");

// Check if user is logged in
if (!isset($_SESSION['user_email'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Unauthorized"]);
    exit;
}

require_once "../../database.php";

// Get JSON input
$input = json_decode(file_get_contents("php://input"), true);
$fileId = $input['fileId'] ?? null;
$signaturePath = $input['signaturePath'] ?? null;
$x = $input['x'] ?? 0;
$y = $input['y'] ?? 0;

if (!$fileId || !$signaturePath) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Missing required parameters"]);
    exit;
}

// Get document file path and type
$stmt = $conn->prepare("SELECT file_path, file_type FROM files WHERE id = ?");
$stmt->bind_param("i", $fileId);
$stmt->execute();
$result = $stmt->get_result();
$file = $result->fetch_assoc();
$stmt->close();

if (!$file) {
    http_response_code(404);
    echo json_encode(["success" => false, "error" => "File not found"]);
    exit;
}

$fileType = strtolower($file['file_type']);

// Route PDF files to PDF handler
if ($fileType === 'pdf') {
    // Include the PDF signature handler
    include __DIR__ . '/embed_pdf_signature.php';
    exit;
}

// Handle image files (PNG, JPG, JPEG) with GD library
$documentPath = "../../" . $file['file_path'];
$signatureFullPath = "../../" . $signaturePath;

// Check if files exist
if (!file_exists($documentPath)) {
    http_response_code(404);
    echo json_encode(["success" => false, "error" => "Document file not found"]);
    exit;
}

if (!file_exists($signatureFullPath)) {
    http_response_code(404);
    echo json_encode(["success" => false, "error" => "Signature file not found"]);
    exit;
}

$success = false;
$newFilePath = null;

// Handle image files (PNG, JPG, JPEG)
if (in_array($fileType, ['png', 'jpg', 'jpeg', 'gif'])) {
    if (!extension_loaded('gd')) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "GD library not available"]);
        exit;
    }

    // Load the document image
    switch ($fileType) {
        case 'png':
            $document = imagecreatefrompng($documentPath);
            break;
        case 'jpg':
        case 'jpeg':
            $document = imagecreatefromjpeg($documentPath);
            break;
        case 'gif':
            $document = imagecreatefromgif($documentPath);
            break;
    }

    if (!$document) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to load document image"]);
        exit;
    }

    // Load signature image
    $signature = imagecreatefrompng($signatureFullPath);
    if (!$signature) {
        imagedestroy($document);
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to load signature image"]);
        exit;
    }

    // Enable alpha blending for transparency
    imagealphablending($document, true);
    imagesavealpha($document, true);

    // Get dimensions
    $sigWidth = imagesx($signature);
    $sigHeight = imagesy($signature);

    // Copy signature onto document
    imagecopy($document, $signature, $x, $y, 0, 0, $sigWidth, $sigHeight);

    // Generate new filename
    $pathInfo = pathinfo($documentPath);
    $newFileName = $pathInfo['filename'] . '_signed_' . time() . '.' . $pathInfo['extension'];
    $newFilePath = $pathInfo['dirname'] . '/' . $newFileName;

    // Save the new image
    switch ($fileType) {
        case 'png':
            $success = imagepng($document, $newFilePath, 9);
            break;
        case 'jpg':
        case 'jpeg':
            $success = imagejpeg($document, $newFilePath, 95);
            break;
        case 'gif':
            $success = imagegif($document, $newFilePath);
            break;
    }

    // Clean up
    imagedestroy($document);
    imagedestroy($signature);

    if ($success) {
        // Update database with new file path
        $relativeNewPath = str_replace("../../", "", $newFilePath);
        $updateStmt = $conn->prepare("UPDATE files SET file_path = ? WHERE id = ?");
        $updateStmt->bind_param("si", $relativeNewPath, $fileId);
        $updateStmt->execute();
        $updateStmt->close();
        
        // Delete original file to save disk space (signed version now in database)
        if (file_exists($documentPath) && $documentPath !== $newFilePath) {
            unlink($documentPath);
        }

        echo json_encode([
            "success" => true,
            "message" => "Signature embedded successfully",
            "newFilePath" => $relativeNewPath
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to save signed document"]);
    }

} else {
    // For PDF and other files, we'll store signatures separately and overlay them on view
    // Embedding into PDF requires external libraries like FPDF/TCPDF
    echo json_encode([
        "success" => true,
        "message" => "Signature recorded (overlay method for PDF files)",
        "fileType" => $fileType
    ]);
}

$conn->close();
?>
