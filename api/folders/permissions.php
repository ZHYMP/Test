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

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

if ($method === 'GET') {
    // Get all departments with employees (exclude admin departments)
    $departmentQuery = "SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != '' AND role = 'employee' ORDER BY department ASC";
    $departmentResult = $conn->query($departmentQuery);
    
    if (!$departmentResult) {
        echo json_encode(['error' => $conn->error]);
        exit;
    }
    
    $departments = [];
    while ($row = $departmentResult->fetch_assoc()) {
        $departments[] = $row['department'];
    }
    
    echo json_encode(['success' => true, 'departments' => $departments]);
    exit;
}

if ($method === 'POST' && isset($input['action'])) {
    
    if ($input['action'] === 'get_department_users') {
        // Get users by department
        if (!isset($input['department'])) {
            echo json_encode(['error' => 'Department is required']);
            exit;
        }
        
        $department = $input['department'];
        
        // Check if "all" is selected to get all employees
        if ($department === 'all') {
            $query = "
                SELECT 
                    id,
                    name,
                    email,
                    department,
                    role
                FROM users 
                WHERE role = 'employee'
                ORDER BY name ASC
            ";
            
            $result = $conn->query($query);
            
            $users = [];
            while ($row = $result->fetch_assoc()) {
                $users[] = $row;
            }
            
            echo json_encode(['success' => true, 'users' => $users]);
            exit;
        }
        
        $query = "
            SELECT 
                id,
                name,
                email,
                department,
                role
            FROM users 
            WHERE department = ? AND role = 'employee'
            ORDER BY name ASC
        ";
        
        $stmt = $conn->prepare($query);
        $stmt->bind_param("s", $department);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
        
        $stmt->close();
        
        echo json_encode(['success' => true, 'users' => $users]);
        exit;
    }
    
    if ($input['action'] === 'set_folder_permissions') {
        // Set permissions for folder
        if (!isset($input['folderId']) || !isset($input['permissions'])) {
            echo json_encode(['error' => 'folderId and permissions are required']);
            exit;
        }
        
        $folderId = (int)$input['folderId'];
        $permissions = $input['permissions']; // Array of user IDs
        
        // Delete existing permissions
        $deleteStmt = $conn->prepare("DELETE FROM folder_permissions WHERE folder_id = ?");
        $deleteStmt->bind_param("i", $folderId);
        $deleteStmt->execute();
        $deleteStmt->close();
        
        // Insert new permissions
        if (!empty($permissions) && is_array($permissions)) {
            $insertStmt = $conn->prepare("
                INSERT INTO folder_permissions (folder_id, user_id)
                VALUES (?, ?)
            ");
            
            foreach ($permissions as $userId) {
                $userId = (int)$userId;
                $insertStmt->bind_param("ii", $folderId, $userId);
                if (!$insertStmt->execute()) {
                    echo json_encode(['error' => 'Failed to set permissions']);
                    exit;
                }
            }
            $insertStmt->close();
        }
        
        echo json_encode(['success' => true, 'message' => 'Permissions updated successfully']);
        exit;
    }
    
    if ($input['action'] === 'get_folder_permissions') {
        // Get folder permissions
        if (!isset($input['folderId'])) {
            echo json_encode(['error' => 'folderId is required']);
            exit;
        }
        
        $folderId = (int)$input['folderId'];
        
        $query = "
            SELECT 
                fp.user_id AS userId,
                u.name,
                u.email,
                u.department
            FROM folder_permissions fp
            LEFT JOIN users u ON fp.user_id = u.id
            WHERE fp.folder_id = ?
        ";
        
        $stmt = $conn->prepare($query);
        $stmt->bind_param("i", $folderId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $permissions = [];
        while ($row = $result->fetch_assoc()) {
            $permissions[] = $row;
        }
        
        $stmt->close();
        
        echo json_encode(['success' => true, 'permissions' => $permissions]);
        exit;
    }
}

echo json_encode(['error' => 'Invalid request']);
?>
