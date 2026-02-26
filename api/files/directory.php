<?php
require_once '../../session_config.php';
session_start();
header('Content-Type: application/json');

include '../../database.php';

if (!$conn) {
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// Check if user is logged in
if (!isset($_SESSION['user_email'])) {
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

// Get current user info
$userStmt = $conn->prepare("SELECT id, role, name FROM users WHERE email = ? LIMIT 1");
$userStmt->bind_param("s", $_SESSION['user_email']);
$userStmt->execute();
$userResult = $userStmt->get_result();
$currentUser = $userResult->fetch_assoc();
$userStmt->close();

if (!$currentUser) {
    echo json_encode(['success' => false, 'error' => 'User not found']);
    exit;
}

// Get query parameters
$status = isset($_GET['status']) ? $_GET['status'] : 'approved';
$department = isset($_GET['department']) ? $_GET['department'] : 'all';

// Validate status
$validStatuses = ['approved', 'in-progress', 'declined', 'pending', 'review'];
if (!in_array($status, $validStatuses)) {
    $status = 'approved';
}

// Build main query
$query = "
    SELECT 
        f.id,
        f.name,
        f.file_type AS type,
        f.file_size AS size,
        f.file_path AS filePath,
        f.status,
        f.department,
        f.requires_signature AS requiresSignature,
        DATE_FORMAT(f.uploaded_at, '%b %d, %Y') AS uploadDate,
        DATE_FORMAT(f.uploaded_at, '%b %d, %Y') AS date,
        DATE_FORMAT(f.modified_at, '%b %d, %Y') AS modifiedDate,
        u.name AS owner,
        u.id AS ownerId
    FROM files f
    LEFT JOIN users u ON f.owner_id = u.id
    WHERE 1=1
";

$params = [];
$types = "";

// Handle status filter - "in-progress" shows all pending/review/in-progress files
// This matches the dashboard behavior so files appear in both places
if ($status === 'in-progress') {
    $query .= " AND f.status IN ('pending', 'review', 'in-progress')";
} else {
    $query .= " AND f.status = ?";
    $params[] = $status;
    $types .= "s";
}

// Add department filter if not 'all'
if ($department !== 'all') {
    $query .= " AND f.department = ?";
    $params[] = $department;
    $types .= "s";
}

// Admin sees all files, employees see only their own
if ($currentUser['role'] === 'employee') {
    $query .= " AND f.owner_id = ?";
    $params[] = $currentUser['id'];
    $types .= "i";
}

$query .= " ORDER BY f.modified_at DESC";

$stmt = $conn->prepare($query);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

$files = [];
while ($row = $result->fetch_assoc()) {
    $row['requiresSignature'] = (bool)$row['requiresSignature'];
    
    // Get signatories if file requires signature
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
        
        $row['signatories'] = [];
        while ($sigRow = $sigResult->fetch_assoc()) {
            $sigRow['signed'] = (bool)$sigRow['signed'];
            $row['signatories'][] = $sigRow;
        }
        $sigStmt->close();
    }
    
    // Get comments
    $commentQuery = "
        SELECT 
            fc.id,
            u.name AS user,
            fc.message,
            fc.action,
            DATE_FORMAT(fc.created_at, '%b %d, %Y at %H:%i') AS timestamp
        FROM file_comments fc
        LEFT JOIN users u ON fc.user_id = u.id
        WHERE fc.file_id = ?
        ORDER BY fc.created_at DESC
    ";
    
    $commentStmt = $conn->prepare($commentQuery);
    $commentStmt->bind_param("i", $row['id']);
    $commentStmt->execute();
    $commentResult = $commentStmt->get_result();
    
    $row['comments'] = [];
    while ($commentRow = $commentResult->fetch_assoc()) {
        $row['comments'][] = $commentRow;
    }
    $commentStmt->close();
    
    $files[] = $row;
}

$stmt->close();

// Get status counts
$countQuery = "
    SELECT 
        status,
        COUNT(*) AS count
    FROM files f
    WHERE 1=1
";

$countParams = [];
$countTypes = "";

// Apply same filters
if ($department !== 'all') {
    $countQuery .= " AND department = ?";
    $countParams[] = $department;
    $countTypes .= "s";
}

if ($currentUser['role'] === 'employee') {
    $countQuery .= " AND owner_id = ?";
    $countParams[] = $currentUser['id'];
    $countTypes .= "i";
}

$countQuery .= " GROUP BY status";

$countStmt = $conn->prepare($countQuery);
if (!empty($countParams)) {
    $countStmt->bind_param($countTypes, ...$countParams);
}
$countStmt->execute();
$countResult = $countStmt->get_result();

$counts = [
    'approved' => 0,
    'in-progress' => 0,
    'declined' => 0
];

while ($countRow = $countResult->fetch_assoc()) {
    $status = $countRow['status'];
    $count = (int)$countRow['count'];
    
    // Aggregate pending, review, and in-progress under 'in-progress' counter
    // This matches dashboard behavior
    if (in_array($status, ['pending', 'review', 'in-progress'])) {
        $counts['in-progress'] += $count;
    } elseif ($status === 'approved') {
        $counts['approved'] = $count;
    } elseif ($status === 'declined') {
        $counts['declined'] = $count;
    }
}

$countStmt->close();
$conn->close();

echo json_encode([
    'success' => true,
    'files' => $files,
    'counts' => $counts
]);
?>
