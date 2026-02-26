<?php
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

$fileId = $_GET['fileId'] ?? null;

if (!$fileId) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Missing fileId parameter"]);
    exit;
}

// Get all signatures for this document
$stmt = $conn->prepare("
    SELECT 
        fs.signature_path,
        fs.signature_x,
        fs.signature_y,
        fs.signature_method,
        fs.signed_date,
        u.name as signatory_name
    FROM file_signatories fs
    JOIN users u ON fs.user_id = u.id
    WHERE fs.file_id = ? AND fs.signed = 1
    ORDER BY fs.signed_date ASC
");

$stmt->bind_param("i", $fileId);
$stmt->execute();
$result = $stmt->get_result();

$signatures = [];
while ($row = $result->fetch_assoc()) {
    $signatures[] = [
        'path' => $row['signature_path'],
        'x' => (int)$row['signature_x'],
        'y' => (int)$row['signature_y'],
        'method' => $row['signature_method'],
        'signedDate' => $row['signed_date'],
        'signatoryName' => $row['signatory_name']
    ];
}

$stmt->close();
$conn->close();

echo json_encode([
    "success" => true,
    "signatures" => $signatures
]);
?>
