<?php
/**
 * Utility Function: Embed All Signatures into Document
 * 
 * This function checks if all signatories have signed a document.
 * If all have signed, it embeds all signatures into the file (PDF or Image).
 * 
 * Used by: api/signatures/save.php
 * Can be included and called after a signature is saved.
 */

require_once __DIR__ . '/../../database.php';

/**
 * Embed all signatures into a document file
 * 
 * @param mysqli $conn Database connection
 * @param int $fileId The file ID to process
 * @return array Result array with 'success', 'message', and optionally 'newFilePath'
 */
function embedAllSignaturesIntoFile($conn, $fileId) {
    try {
        // Get file details
        $fileStmt = $conn->prepare("
            SELECT id, file_path, name, file_type 
            FROM files 
            WHERE id = ?
        ");
        $fileStmt->bind_param("i", $fileId);
        $fileStmt->execute();
        $fileResult = $fileStmt->get_result();
        $file = $fileResult->fetch_assoc();
        $fileStmt->close();
        
        if (!$file) {
            return ["success" => false, "error" => "File not found"];
        }
        
        // Get all signatories for this file
        $sigStmt = $conn->prepare("
            SELECT 
                fs.id,
                fs.user_id,
                fs.signed,
                fs.signature_path,
                fs.signature_x,
                fs.signature_y,
                fs.signature_method,
                u.name as user_name
            FROM file_signatories fs
            JOIN users u ON fs.user_id = u.id
            WHERE fs.file_id = ?
            ORDER BY fs.id ASC
        ");
        $sigStmt->bind_param("i", $fileId);
        $sigStmt->execute();
        $sigResult = $sigStmt->get_result();
        
        $signatories = [];
        $allSigned = true;
        
        while ($row = $sigResult->fetch_assoc()) {
            $signatories[] = $row;
            if ($row['signed'] != 1) {
                $allSigned = false;
            }
        }
        $sigStmt->close();
        
        // If not all signatories have signed, don't embed yet
        if (!$allSigned) {
            return [
                "success" => true,
                "embedded" => false,
                "message" => "Signature saved! Waiting for remaining signatories to sign."
            ];
        }
        
        // Check if file is already embedded (file_path contains 'signed/')
        if (strpos($file['file_path'], 'uploads/signed/') !== false) {
            return [
                "success" => true,
                "embedded" => false,
                "message" => "Signature saved! All signatures are already embedded in this document."
            ];
        }
        
        $fileType = strtolower($file['file_type']);
        
        // Handle PDF files
        if ($fileType === 'pdf') {
            return embedSignaturesIntoPDF($conn, $file, $signatories);
        }
        
        // Handle image files
        if (in_array($fileType, ['png', 'jpg', 'jpeg', 'gif'])) {
            return embedSignaturesIntoImage($conn, $file, $signatories);
        }
        
        // For other file types (DOCX, XLSX, etc.), signatures are stored in database only
        $signatoryCount = count($signatories);
        return [
            "success" => true,
            "embedded" => false,
            "message" => "✓ All signatures collected! ({$signatoryCount} of {$signatoryCount}) Document type: {$fileType}. Signatures are stored in the system and visible when viewing the document."
        ];
        
    } catch (Exception $e) {
        return [
            "success" => false,
            "error" => "Embedding error: " . $e->getMessage()
        ];
    }
}

/**
 * Embed signatures into PDF using FPDI + TCPDF
 */
function embedSignaturesIntoPDF($conn, $file, $signatories) {
    // Check if FPDI/TCPDF libraries are available
    $autoloadPath = __DIR__ . '/../../vendor/autoload.php';
    if (!file_exists($autoloadPath)) {
        return [
            "success" => false,
            "error" => "FPDI/TCPDF libraries not installed. Run: composer require setasign/fpdi tecnickcom/tcpdf"
        ];
    }
    
    require_once $autoloadPath;
    
    try {
        $pdf = new \setasign\Fpdi\Tcpdf\Fpdi();
        $pdf->SetMargins(0, 0, 0);
        $pdf->SetAutoPageBreak(false);
        
        $documentPath = __DIR__ . '/../../' . $file['file_path'];
        
        if (!file_exists($documentPath)) {
            throw new Exception("Document file not found: " . $documentPath);
        }
        
        // Get number of pages
        $pageCount = $pdf->setSourceFile($documentPath);
        
        // Import all pages
        for ($i = 1; $i <= $pageCount; $i++) {
            $templateId = $pdf->importPage($i);
            $size = $pdf->getTemplateSize($templateId);
            
            // Add page with original size
            $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
            $pdf->useTemplate($templateId);
        }
        
        // Add all signatures to the last page
        $lastPage = $pageCount;
        $pdf->setPage($lastPage);
        
        foreach ($signatories as $index => $signatory) {
            if (empty($signatory['signature_path'])) {
                continue;
            }
            
            $signaturePath = __DIR__ . '/../../' . $signatory['signature_path'];
            
            if (!file_exists($signaturePath)) {
                continue;
            }
            
            // Convert pixel coordinates to mm (approximate conversion)
            // Assuming 96 DPI: 1px = 0.264583mm
            $xMm = $signatory['signature_x'] * 0.264583;
            $yMm = $signatory['signature_y'] * 0.264583;
            
            // Default signature size in mm
            $widthMm = 40;
            $heightMm = 20;
            
            // Add signature image
            $pdf->Image($signaturePath, $xMm, $yMm, $widthMm, $heightMm, 'PNG');
            
            // Add signer name and date below signature
            $pdf->SetFont('helvetica', '', 8);
            $pdf->SetTextColor(60, 60, 60);
            $pdf->SetXY($xMm, $yMm + $heightMm + 1);
            $pdf->Cell($widthMm, 4, 'Signed by: ' . $signatory['user_name'], 0, 1, 'L');
            $pdf->SetXY($xMm, $yMm + $heightMm + 5);
            $pdf->Cell($widthMm, 4, 'Date: ' . date('Y-m-d H:i:s'), 0, 1, 'L');
        }
        
        // Generate new filename
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
        $updateStmt = $conn->prepare("UPDATE files SET file_path = ?, modified_at = NOW() WHERE id = ?");
        $updateStmt->bind_param("si", $relativeNewPath, $file['id']);
        $updateStmt->execute();
        $updateStmt->close();
        
        // Delete original file to save disk space
        if (file_exists($documentPath)) {
            unlink($documentPath);
        }
        
        // Log activity
        $activity = "All signatures embedded into document";
        $activityStmt = $conn->prepare("
            INSERT INTO recent_activities (user_id, file_id, action, description) 
            VALUES (1, ?, 'signed_complete', ?)
        ");
        $activityStmt->bind_param("is", $file['id'], $activity);
        $activityStmt->execute();
        $activityStmt->close();
        
        return [
            "success" => true,
            "embedded" => true,
            "message" => "All signatures embedded into PDF successfully",
            "newFilePath" => $relativeNewPath
        ];
        
    } catch (Exception $e) {
        return [
            "success" => false,
            "error" => "PDF embedding failed: " . $e->getMessage()
        ];
    }
}

/**
 * Embed signatures into image files using GD library
 */
function embedSignaturesIntoImage($conn, $file, $signatories) {
    if (!extension_loaded('gd')) {
        return [
            "success" => false,
            "error" => "GD library not available"
        ];
    }
    
    try {
        $documentPath = __DIR__ . '/../../' . $file['file_path'];
        
        if (!file_exists($documentPath)) {
            throw new Exception("Document file not found");
        }
        
        $fileType = strtolower($file['file_type']);
        
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
            default:
                throw new Exception("Unsupported image type");
        }
        
        if (!$document) {
            throw new Exception("Failed to load document image");
        }
        
        // Enable alpha blending for transparency
        imagealphablending($document, true);
        imagesavealpha($document, true);
        
        // Add each signature
        foreach ($signatories as $signatory) {
            if (empty($signatory['signature_path'])) {
                continue;
            }
            
            $signaturePath = __DIR__ . '/../../' . $signatory['signature_path'];
            
            if (!file_exists($signaturePath)) {
                continue;
            }
            
            $signature = imagecreatefrompng($signaturePath);
            if (!$signature) {
                continue;
            }
            
            $sigWidth = imagesx($signature);
            $sigHeight = imagesy($signature);
            
            // Copy signature onto document at stored coordinates
            imagecopy(
                $document, 
                $signature, 
                $signatory['signature_x'], 
                $signatory['signature_y'], 
                0, 
                0, 
                $sigWidth, 
                $sigHeight
            );
            
            imagedestroy($signature);
        }
        
        // Generate new filename
        $pathInfo = pathinfo($documentPath);
        $newFileName = $pathInfo['filename'] . '_signed_' . time() . '.' . $pathInfo['extension'];
        $uploadsDir = __DIR__ . '/../../uploads/signed/';
        
        if (!is_dir($uploadsDir)) {
            mkdir($uploadsDir, 0755, true);
        }
        
        $newFilePath = $uploadsDir . $newFileName;
        
        // Save the new image
        $success = false;
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
        
        imagedestroy($document);
        
        if (!$success) {
            throw new Exception("Failed to save signed image");
        }
        
        // Update database
        $relativeNewPath = 'uploads/signed/' . $newFileName;
        $updateStmt = $conn->prepare("UPDATE files SET file_path = ?, modified_at = NOW() WHERE id = ?");
        $updateStmt->bind_param("si", $relativeNewPath, $file['id']);
        $updateStmt->execute();
        $updateStmt->close();
        
        // Delete original file
        if (file_exists($documentPath)) {
            unlink($documentPath);
        }
        
        // Log activity
        $activity = "All signatures embedded into image";
        $activityStmt = $conn->prepare("
            INSERT INTO recent_activities (user_id, file_id, action, description) 
            VALUES (1, ?, 'signed_complete', ?)
        ");
        $activityStmt->bind_param("is", $file['id'], $activity);
        $activityStmt->execute();
        $activityStmt->close();
        
        return [
            "success" => true,
            "embedded" => true,
            "message" => "All signatures embedded into image successfully",
            "newFilePath" => $relativeNewPath
        ];
        
    } catch (Exception $e) {
        return [
            "success" => false,
            "error" => "Image embedding failed: " . $e->getMessage()
        ];
    }
}
?>
