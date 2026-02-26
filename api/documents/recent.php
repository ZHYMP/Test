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

// Get current user and role
$userStmt = $conn->prepare("SELECT id, role FROM users WHERE email = ? LIMIT 1");
$userStmt->bind_param("s", $_SESSION['user_email']);
$userStmt->execute();
$userResult = $userStmt->get_result();
$currentUser = $userResult->fetch_assoc();
$userStmt->close();

if (!$currentUser) {
    echo json_encode(['error' => 'User not found']);
    exit;
}

// Get recent documents (last 5 uploaded)
$query = "
    SELECT 
        f.id,
        f.name AS fileName,
        f.file_size AS fileSize,
        f.file_type AS type,
        f.department,
        owner.name AS owner,
        CASE 
            WHEN DATE(f.uploaded_at) = CURDATE() THEN 'Today'
            WHEN DATE(f.uploaded_at) = CURDATE() - INTERVAL 1 DAY THEN 'Yesterday'
            ELSE DATE_FORMAT(f.uploaded_at, '%b %d, %Y')
        END AS date
    FROM files f
    LEFT JOIN users owner ON f.owner_id = owner.id
    WHERE 1=1
";

$params = [];
$types = "";
if ($currentUser['role'] === 'employee') {
    $query .= " AND f.owner_id = ?";
    $params[] = (int)$currentUser['id'];
    $types .= "i";
}

$query .= " ORDER BY f.uploaded_at DESC LIMIT 5";

$stmt = $conn->prepare($query);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

$documents = [];
while ($row = $result->fetch_assoc()) {
    // Set icon based on file type
    $icons = [
        'pdf' => '../assets/pdf_red.svg',
        'xlsx' => '../assets/xlsx_green.svg',
        'xls' => '../assets/xlsx_green.svg',
        'docx' => '../assets/docs_blue.svg',
        'doc' => '../assets/docs_blue.svg',
        'other' => '../assets/docs_blue.svg'
    ];
    
    $row['icon'] = $icons[$row['type']] ?? '../assets/docs_blue.svg';
    
    $documents[] = $row;
}

echo json_encode($documents);
?>
