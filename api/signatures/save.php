<?php
require_once '../../session_config.php';
session_start();
header("Content-Type: application/json");

require_once "../../session_helper.php";
require_once "../../database.php";

// Validate user session and get user info
$user = requireAuth(true);
$userId = $user['id'];

// Get JSON input
$input = json_decode(file_get_contents("php://input"), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid JSON input"]);
    exit;
}

$fileId = $input['fileId'] ?? null;
$signatureData = $input['signatureData'] ?? null;
$x = $input['x'] ?? 0;
$y = $input['y'] ?? 0;
$method = $input['method'] ?? 'draw';

// Validate required fields
if (!$fileId || !$signatureData) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Missing required fields"]);
    exit;
}

$userId = $user['id'];

// Verify user is assigned as signatory for this file
$stmt = $conn->prepare("
    SELECT fs.id, fs.signed, fs.signed_date, u.name as user_name, f.name as file_name
    FROM file_signatories fs
    JOIN users u ON fs.user_id = u.id
    JOIN files f ON fs.file_id = f.id
    WHERE fs.file_id = ? AND fs.user_id = ?
");
$stmt->bind_param("ii", $fileId, $userId);
$stmt->execute();
$result = $stmt->get_result();
$signatory = $result->fetch_assoc();
$stmt->close();

if (!$signatory) {
    // Get more info for debugging
    $debugStmt = $conn->prepare("SELECT COUNT(*) as count FROM file_signatories WHERE file_id = ?");
    $debugStmt->bind_param("i", $fileId);
    $debugStmt->execute();
    $debugResult = $debugStmt->get_result()->fetch_assoc();
    $debugStmt->close();
    
    http_response_code(403);
    echo json_encode([
        "success" => false, 
        "error" => "You are not assigned as a signatory for this document",
        "debug" => "File has " . $debugResult['count'] . " signatories, but you are not one of them. Your user ID: " . $userId
    ]);
    exit;
}

// Check if already signed
if ($signatory['signed'] == 1) {
    http_response_code(400);
    echo json_encode([
        "success" => false, 
        "error" => "You have already signed this document on " . date('M d, Y', strtotime($signatory['signed_date'])) . ". Signatures cannot be edited.",
        "debug" => "User: " . $signatory['user_name'] . ", Document: " . $signatory['file_name']
    ]);
    exit;
}

// Save signature to uploads directory
$signatureFileName = uniqid("signature_") . ".png";
$signaturePath = "../../uploads/" . $signatureFileName;

// Extract base64 data and save
$signatureDataParts = explode(',', $signatureData);
$signatureBase64 = end($signatureDataParts);
$signatureBinary = base64_decode($signatureBase64);

if (!$signatureBinary) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid signature data"]);
    exit;
}

// Create uploads directory if it doesn't exist
if (!file_exists("../../uploads/")) {
    mkdir("../../uploads/", 0777, true);
}

// Save signature file
if (!file_put_contents($signaturePath, $signatureBinary)) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Failed to save signature file"]);
    exit;
}

// Update database with atomic check (prevents race conditions)
// The WHERE clause includes "signed = 0" to ensure only one request succeeds
$updateStmt = $conn->prepare("
    UPDATE file_signatories 
    SET signed = 1, 
        signed_date = NOW(), 
        signature_path = ?,
        signature_x = ?,
        signature_y = ?,
        signature_method = ?
    WHERE file_id = ? AND user_id = ? AND signed = 0
");

$dbSignaturePath = "uploads/" . $signatureFileName;
$updateStmt->bind_param("siisii", $dbSignaturePath, $x, $y, $method, $fileId, $userId);

if ($updateStmt->execute()) {
    // Check if any row was actually updated
    $rowsAffected = $updateStmt->affected_rows;
    $updateStmt->close();
    
    if ($rowsAffected > 0) {
        // Success - signature saved
        
        // Now check if all signatories have signed and embed signatures if ready
        require_once __DIR__ . '/embed_all_signatures.php';
        $embedResult = embedAllSignaturesIntoFile($conn, $fileId);
        
        $conn->close();
        
        // Return success with embedding information
        $response = [
            "success" => true,
            "message" => "Signature saved successfully",
            "signaturePath" => $dbSignaturePath
        ];
        
        // Add embedding status to response
        if ($embedResult['embedded']) {
            $response['signaturesEmbedded'] = true;
            $response['embeddedMessage'] = $embedResult['message'];
            if (isset($embedResult['newFilePath'])) {
                $response['newFilePath'] = $embedResult['newFilePath'];
            }
        } else {
            $response['signaturesEmbedded'] = false;
            $response['embeddedMessage'] = $embedResult['message'] ?? 'Waiting for all signatories';
        }
        
        echo json_encode($response);
    } else {
        // No rows updated = already signed by concurrent request
        unlink($signaturePath); // Delete the uploaded file
        $conn->close();
        
        http_response_code(409); // Conflict
        echo json_encode([
            "success" => false, 
            "error" => "Document already signed. Another signature submission was processed first."
        ]);
    }
} else {
    // If database update fails, delete the uploaded file
    unlink($signaturePath);
    $updateStmt->close();
    $conn->close();
    
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Failed to update database"]);
}
?>
