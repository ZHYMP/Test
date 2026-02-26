<?php
require_once '../session_config.php';
session_start();

include '../database.php';

if (!$conn) {
    die("Database connection failed");
}

if (!isset($_SESSION['otp_email']) || !isset($_SESSION['otp_purpose'])) {
    die("Unauthorized access");
}

$email = $_SESSION['otp_email'];
$purpose = $_SESSION['otp_purpose'];
$enteredOtp = isset($_POST['otp']) ? trim($_POST['otp']) : '';

$stmt = $conn->prepare(
    "SELECT otp FROM users WHERE email = ?"
);
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

$row = $result->fetch_assoc();

if ($row && $row['otp'] === $enteredOtp) {

    // OTP verified → remove OTP
    $clear = $conn->prepare(
        "UPDATE users SET otp = NULL WHERE email = ?"
    );
    $clear->bind_param("s", $email);
    $clear->execute();

    unset($_SESSION['otp_email']);
    unset($_SESSION['otp_purpose']);

    if ($purpose === 'signup') {
        // Signup verified, set success message
        $_SESSION['signup_success'] = "Account created successfully! Please log in.";
        header("Location: ../login/login.php");
        exit;
    } elseif ($purpose === 'login') {
        // Login verified, set session and redirect to dashboard
        // Get complete user info for session
        $stmt = $conn->prepare("SELECT id, name, email, role, department FROM users WHERE email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();
        
        if ($user) {
            // Store complete user info in session for security and performance
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_email'] = $user['email'];
            $_SESSION['user_name'] = $user['name'];
            $_SESSION['user_role'] = $user['role'];
            $_SESSION['user_department'] = $user['department'];
            
            // Redirect based on role
            if ($user['role'] === 'admin') {
                header("Location: ../admin_dashboard/m_dashboard.html");
            } else {
                header("Location: ../employee_dashboard/e_dashboard.html");
            }
        } else {
            $_SESSION['otp_error'] = "User not found";
            header("Location: otp_email.php");
        }
        exit;
    } elseif ($purpose === 'forgot') {
        // Forgot password, redirect to new password
        $_SESSION['reset_email'] = $email;
        header("Location: ../forgot_password/new_pass.html");
        exit;
    }

} else {
    // Invalid OTP, redirect back with error
    $_SESSION['otp_error'] = "Invalid OTP. Please try again.";
    header("Location: otp_email.php");
    exit;
}
