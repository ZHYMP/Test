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

// Get department filter from query parameter
$department = isset($_GET['department']) ? $_GET['department'] : 'all';

// Get status filter from query parameter
$statusFilter = isset($_GET['status']) ? $_GET['status'] : null;

// Build query
$query = "
    SELECT 
        f.id,
        f.name AS fileName,
        f.status,
        f.due_date AS dueDate,
        f.department,
        f.file_type AS type,
        f.file_path AS filePath,
        f.file_size AS size,
        f.requires_signature AS requiresSignature,
        DATE_FORMAT(f.uploaded_at, '%b %d, %Y') AS dateUploaded,
        owner.name AS owner,
        staff.name AS staff
    FROM files f
    LEFT JOIN users owner ON f.owner_id = owner.id
    LEFT JOIN users staff ON f.owner_id = staff.id
    WHERE 1=1
";

// Add status filter
$params = [];
$types = "";
if ($statusFilter) {
    $query .= " AND f.status = ?";
    $params[] = $statusFilter;
    $types .= "s";
} else {
    // Default: show pending, review, in-progress
    $query .= " AND f.status IN ('pending', 'review', 'in-progress')";
}

// Add department filter if not 'all'
if ($department !== 'all') {
    $query .= " AND f.department = ?";
    $params[] = $department;
    $types .= "s";
}

// Employees should only see their own documents
if ($currentUser['role'] === 'employee') {
    $query .= " AND f.owner_id = ?";
    $params[] = (int)$currentUser['id'];
    $types .= "i";
}

$query .= " ORDER BY f.due_date ASC";

$stmt = $conn->prepare($query);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

$documents = [];
while ($row = $result->fetch_assoc()) {
    // Set preview icon based on file type
    $previewIcons = [
        'pdf' => '../assets/pdf_red.svg',
        'xlsx' => '../assets/xlsx_green.svg',
        'xls' => '../assets/xlsx_green.svg',
        'docx' => '../assets/docs_blue.svg',
        'doc' => '../assets/docs_blue.svg',
        'other' => '../assets/docs_blue.svg'
    ];
    
    $row['preview'] = $previewIcons[$row['type']] ?? '../assets/docs_blue.svg';
    $row['requiresSignature'] = (bool)$row['requiresSignature'];
    
    // Get signatories if document requires signature
    if ($row['requiresSignature']) {
        $sigQuery = "
            SELECT 
                fs.user_id AS userId,
                u.name,
                fs.signed,
                DATE_FORMAT(fs.signed_date, '%Y-%m-%d') AS signedDate
            FROM file_signatories fs
            LEFT JOIN users u ON fs.user_id = u.id
            WHERE fs.file_id = ?
            ORDER BY fs.id
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
        $row['signatories'] = $signatories;
    }
    
    $documents[] = $row;
}

echo json_encode($documents);
?>
