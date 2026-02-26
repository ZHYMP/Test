<?php
require_once '../../session_config.php';
session_start();
header("Content-Type: application/json");

require_once "../../session_helper.php";
require_once "../../database.php";

// Validate user session and get user info
$user = requireAuth(true);
$userId = $user['id'];

$method = $_SERVER['REQUEST_METHOD'];

// ============================================================================
// GET - Retrieve all saved signatures for user
// ============================================================================
if ($method === 'GET') {
    $stmt = $conn->prepare("
        SELECT 
            id,
            signature_name AS name,
            signature_path AS path,
            signature_method AS method,
            is_default AS isDefault,
            DATE_FORMAT(created_at, '%b %d, %Y') AS createdDate
        FROM saved_signatures
        WHERE user_id = ?
        ORDER BY is_default DESC, created_at DESC
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $signatures = [];
    while ($row = $result->fetch_assoc()) {
        $row['isDefault'] = (bool)$row['isDefault'];
        $signatures[] = $row;
    }
    
    $stmt->close();
    $conn->close();
    
    echo json_encode([
        "success" => true,
        "signatures" => $signatures
    ]);
    exit;
}

// ============================================================================
// POST - Save a new signature
// ============================================================================
if ($method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Invalid JSON input"]);
        exit;
    }
    
    $signatureName = $input['signatureName'] ?? null;
    $signatureData = $input['signatureData'] ?? null;
    $method = $input['method'] ?? 'draw';
    $setAsDefault = $input['setAsDefault'] ?? false;
    
    // Validate required fields
    if (!$signatureName || !$signatureData) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing signature name or data"]);
        exit;
    }
    
    // Save signature file
    $signatureFileName = uniqid("saved_sig_") . ".png";
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
    
    $dbSignaturePath = "uploads/" . $signatureFileName;
    
    // If setting as default, unset all other defaults first
    if ($setAsDefault) {
        $stmt = $conn->prepare("UPDATE saved_signatures SET is_default = 0 WHERE user_id = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $stmt->close();
    }
    
    // Insert into database
    $stmt = $conn->prepare("
        INSERT INTO saved_signatures (user_id, signature_name, signature_path, signature_method, is_default)
        VALUES (?, ?, ?, ?, ?)
    ");
    $isDefault = $setAsDefault ? 1 : 0;
    $stmt->bind_param("isssi", $userId, $signatureName, $dbSignaturePath, $method, $isDefault);
    
    if ($stmt->execute()) {
        $signatureId = $conn->insert_id;
        $stmt->close();
        $conn->close();
        
        echo json_encode([
            "success" => true,
            "message" => "Signature saved successfully",
            "signatureId" => $signatureId,
            "signaturePath" => $dbSignaturePath
        ]);
    } else {
        unlink($signaturePath); // Delete file if DB insert fails
        $stmt->close();
        $conn->close();
        
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to save signature"]);
    }
    exit;
}

// ============================================================================
// DELETE - Remove a saved signature
// ============================================================================
if ($method === 'DELETE') {
    $input = json_decode(file_get_contents("php://input"), true);
    
    if (!$input || !isset($input['signatureId'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing signature ID"]);
        exit;
    }
    
    $signatureId = $input['signatureId'];
    
    // Get signature details (verify ownership and get file path)
    $stmt = $conn->prepare("
        SELECT signature_path 
        FROM saved_signatures 
        WHERE id = ? AND user_id = ?
    ");
    $stmt->bind_param("ii", $signatureId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $signature = $result->fetch_assoc();
    $stmt->close();
    
    if (!$signature) {
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Signature not found or unauthorized"]);
        exit;
    }
    
    // Delete from database
    $stmt = $conn->prepare("DELETE FROM saved_signatures WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $signatureId, $userId);
    
    if ($stmt->execute()) {
        // Delete file
        $filePath = "../../" . $signature['signature_path'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        
        $stmt->close();
        $conn->close();
        
        echo json_encode([
            "success" => true,
            "message" => "Signature deleted successfully"
        ]);
    } else {
        $stmt->close();
        $conn->close();
        
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to delete signature"]);
    }
    exit;
}

// ============================================================================
// PUT - Update signature (e.g., set as default)
// ============================================================================
if ($method === 'PUT') {
    $input = json_decode(file_get_contents("php://input"), true);
    
    if (!$input || !isset($input['signatureId'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing signature ID"]);
        exit;
    }
    
    $signatureId = $input['signatureId'];
    $setAsDefault = $input['setAsDefault'] ?? false;
    
    // Verify ownership
    $stmt = $conn->prepare("SELECT id FROM saved_signatures WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $signatureId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Signature not found"]);
        exit;
    }
    $stmt->close();
    
    // If setting as default, unset all other defaults first
    if ($setAsDefault) {
        $stmt = $conn->prepare("UPDATE saved_signatures SET is_default = 0 WHERE user_id = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $stmt->close();
        
        // Set new default
        $stmt = $conn->prepare("UPDATE saved_signatures SET is_default = 1 WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $signatureId, $userId);
        $stmt->execute();
        $stmt->close();
    }
    
    $conn->close();
    
    echo json_encode([
        "success" => true,
        "message" => "Signature updated successfully"
    ]);
    exit;
}

// Unsupported method
http_response_code(405);
echo json_encode(["success" => false, "error" => "Method not allowed"]);
?>
