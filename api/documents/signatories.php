<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

include '../../database.php';

if (!$conn) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Check if user is logged in
if (!isset($_SESSION['user_email'])) {
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Get current user
$userStmt = $conn->prepare("SELECT id, name, role FROM users WHERE email = ? LIMIT 1");
$userStmt->bind_param("s", $_SESSION['user_email']);
$userStmt->execute();
$userResult = $userStmt->get_result();
$currentUser = $userResult->fetch_assoc();
$userStmt->close();

if (!$currentUser) {
    echo json_encode(['error' => 'User not found']);
    exit;
}

// Get documents where current user is a signatory
$query = "
    SELECT 
        f.id,
        f.name AS fileName,
        f.file_type AS type,
        f.file_path AS filePath,
        f.file_size AS size,
        f.department,
        f.status,
        f.requires_signature AS requiresSignature,
        DATE_FORMAT(f.uploaded_at, '%b %d, %Y') AS uploadDate,
        owner.name AS owner,
        fs.signed AS currentUserSigned,
        fs.signed_date AS currentUserSignedDate
    FROM file_signatories fs
    INNER JOIN files f ON fs.file_id = f.id
    LEFT JOIN users owner ON f.owner_id = owner.id
    WHERE fs.user_id = ?
    ORDER BY fs.signed ASC, f.uploaded_at DESC
";

$stmt = $conn->prepare($query);
$stmt->bind_param("i", $currentUser['id']);
$stmt->execute();
$result = $stmt->get_result();

$documents = [];
while ($row = $result->fetch_assoc()) {
    // Convert boolean values
    $row['requiresSignature'] = (bool)$row['requiresSignature'];
    $row['currentUserSigned'] = (bool)$row['currentUserSigned'];
    
    // Get all signatories for this document
    $sigQuery = "
        SELECT 
            u.name,
            fs.signed,
            DATE_FORMAT(fs.signed_date, '%Y-%m-%d') AS signedDate
        FROM file_signatories fs
        INNER JOIN users u ON fs.user_id = u.id
        WHERE fs.file_id = ?
        ORDER BY fs.id ASC
    ";
    
    $sigStmt = $conn->prepare($sigQuery);
    $sigStmt->bind_param("i", $row['id']);
    $sigStmt->execute();
    $sigResult = $sigStmt->get_result();
    
    $signatories = [];
    while ($sigRow = $sigResult->fetch_assoc()) {
        $sigRow['signed'] = (bool)$sigRow['signed'];
        $signatories[] = $sigRow;
    }
    $sigStmt->close();
    
    $row['signatories'] = $signatories;
    
    // Add preview icon based on file type
    $previewIcons = [
        'pdf' => '../assets/pdf_red.svg',
        'xlsx' => '../assets/xlsx_green.svg',
        'xls' => '../assets/xlsx_green.svg',
        'docx' => '../assets/docs_blue.svg',
        'doc' => '../assets/docs_blue.svg',
    ];
    
    $row['preview'] = $previewIcons[$row['type']] ?? '../assets/docs_blue.svg';
    
    $documents[] = $row;
}

$stmt->close();
$conn->close();

echo json_encode($documents);
?>
