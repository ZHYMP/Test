<?php
/**
 * PDF Signature Embedding with FPDI + TCPDF
 * 
 * This script embeds signatures into PDF documents
 * Requires: FPDI and TCPDF libraries
 * 
 * Install via Composer: composer require setasign/fpdi tecnickcom/tcpdf
 * Or download manually to /vendor folder
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

// Check if FPDI and TCPDF are available
$fpdiPath = __DIR__ . '/../../vendor/autoload.php';
if (!file_exists($fpdiPath)) {
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "error" => "FPDI/TCPDF libraries not installed",
        "instruction" => "Run: composer require setasign/fpdi tecnickcom/tcpdf"
    ]);
    exit;
}

require_once $fpdiPath;

use setasign\Fpdi\Tcpdf\Fpdi;

// Get JSON input
$input = json_decode(file_get_contents("php://input"), true);
$fileId = $input['fileId'] ?? null;
$signatureId = $input['signatureId'] ?? null;
$signaturePath = $input['signaturePath'] ?? null;
$x = floatval($input['x'] ?? 50);  // X position in mm
$y = floatval($input['y'] ?? 50);  // Y position in mm
$width = floatval($input['width'] ?? 40);  // Signature width in mm
$height = floatval($input['height'] ?? 20); // Signature height in mm
$page = intval($input['page'] ?? 1);  // Which page to sign (default: last page)

if (!$fileId || !$signaturePath) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Missing required parameters (fileId, signaturePath)"]);
    exit;
}

try {
    // Get user info
    $stmt = $conn->prepare("SELECT id, name FROM users WHERE email = ?");
    $stmt->bind_param("s", $_SESSION['user_email']);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$user) {
        throw new Exception("User not found");
    }
    
    // Get document file path
    $stmt = $conn->prepare("SELECT file_path, name, file_type FROM files WHERE id = ?");
    $stmt->bind_param("i", $fileId);
    $stmt->execute();
    $result = $stmt->get_result();
    $file = $result->fetch_assoc();
    $stmt->close();
    
    if (!$file) {
        throw new Exception("File not found");
    }
    
    if ($file['file_type'] !== 'pdf') {
        http_response_code(400);
        echo json_encode([
            "success" => false, 
            "error" => "This endpoint only handles PDF files. File type: " . $file['file_type']
        ]);
        exit;
    }
    
    $documentPath = __DIR__ . '/../../' . $file['file_path'];
    $signatureFullPath = __DIR__ . '/../../' . $signaturePath;
    
    // Verify files exist
    if (!file_exists($documentPath)) {
        throw new Exception("Document file not found: " . $documentPath);
    }
    
    if (!file_exists($signatureFullPath)) {
        throw new Exception("Signature file not found: " . $signatureFullPath);
    }
    
    // Initialize FPDI
    $pdf = new Fpdi();
    $pdf->SetMargins(0, 0, 0);
    $pdf->SetAutoPageBreak(false);
    
    // Get number of pages
    $pageCount = $pdf->setSourceFile($documentPath);
    
    // Determine which page to sign
    if ($page === -1 || $page > $pageCount) {
        $page = $pageCount; // Sign last page if not specified or out of range
    }
    
    // Import all pages
    for ($i = 1; $i <= $pageCount; $i++) {
        $templateId = $pdf->importPage($i);
        $size = $pdf->getTemplateSize($templateId);
        
        // Add page with original size
        $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
        $pdf->useTemplate($templateId);
        
        // Add signature to specified page
        if ($i === $page) {
            // Add signature image
            $pdf->Image($signatureFullPath, $x, $y, $width, $height, 'PNG');
            
            // Add timestamp and signer name below signature
            $pdf->SetFont('helvetica', '', 8);
            $pdf->SetTextColor(100, 100, 100);
            $pdf->SetXY($x, $y + $height + 1);
            $pdf->Cell($width, 4, 'Signed by: ' . $user['name'], 0, 1, 'L');
            $pdf->SetXY($x, $y + $height + 5);
            $pdf->Cell($width, 4, 'Date: ' . date('Y-m-d H:i:s'), 0, 1, 'L');
        }
    }
    
    // Generate new filename with timestamp
    $pathInfo = pathinfo($documentPath);
    $timestamp = time();
    $newFileName = $pathInfo['filename'] . '_signed_' . $timestamp . '.pdf';
    $uploadsDir = __DIR__ . '/../../uploads/signed/';
    
    // Create signed directory if it doesn't exist
    if (!is_dir($uploadsDir)) {
        mkdir($uploadsDir, 0755, true);
    }
    
    $newFilePath = $uploadsDir . $newFileName;
    
    // Save the signed PDF
    $pdf->Output($newFilePath, 'F');
    
    // Update database with new file path
    $relativeNewPath = 'uploads/signed/' . $newFileName;
    $stmt = $conn->prepare("UPDATE files SET file_path = ?, modified_at = NOW() WHERE id = ?");
    $stmt->bind_param("si", $relativeNewPath, $fileId);
    $stmt->execute();
    $stmt->close();
    
    // Delete original file to save disk space (signed version now in database)
    if (file_exists($documentPath)) {
        unlink($documentPath);
    }
    
    // Update file_signatories table
    $stmt = $conn->prepare("
        UPDATE file_signatories 
        SET signed = 1, signed_date = NOW(), signature_data = ? 
        WHERE file_id = ? AND user_id = ?
    ");
    $stmt->bind_param("sii", $relativeNewPath, $fileId, $user['id']);
    $stmt->execute();
    $stmt->close();
    
    // Log activity
    $activity = "Document signed by " . $user['name'];
    $stmt = $conn->prepare("
        INSERT INTO recent_activities (user_id, file_id, action, description) 
        VALUES (?, ?, 'signed', ?)
    ");
    $stmt->bind_param("iis", $user['id'], $fileId, $activity);
    $stmt->execute();
    $stmt->close();
    
    // Add comment to file
    $commentMsg = "Document has been digitally signed";
    $stmt = $conn->prepare("
        INSERT INTO file_comments (file_id, user_id, message, action) 
        VALUES (?, ?, ?, 'signed')
    ");
    $stmt->bind_param("iis", $fileId, $user['id'], $commentMsg);
    $stmt->execute();
    $stmt->close();
    
    echo json_encode([
        "success" => true,
        "message" => "PDF signature embedded successfully",
        "newFilePath" => $relativeNewPath,
        "fileName" => $newFileName
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "error" => $e->getMessage()
    ]);
}

$conn->close();
?>
