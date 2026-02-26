<?php
require_once '../session_config.php';
session_start();

include '../database.php';
include '../mailer_config.php';

if (!$conn) {
    die("Database connection failed");
}

$user_input = trim($_POST['user_input']);
$password = $_POST['password'];

// Check if input is email or username
if (filter_var($user_input, FILTER_VALIDATE_EMAIL)) {
    $email = $user_input;
    $stmt = $conn->prepare("SELECT name, email, password FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
} else {
    // Assume username, find email
    $stmt = $conn->prepare("SELECT name, email, password FROM users WHERE username = ?");
    $stmt->bind_param("s", $user_input);
}
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows == 0) {
    $_SESSION['login_error'] = "Invalid username or password.";
    header("Location: login.php");
    exit;
}
$row = $result->fetch_assoc();
$user_name = $row['name'];
$email = $row['email'];
$hashed_password = $row['password'];

if (!password_verify($password, $hashed_password)) {
    $_SESSION['login_error'] = "Invalid username or password.";
    header("Location: login.php");
    exit;
}

// Generate OTP
$otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

// Update OTP in DB
$stmt = $conn->prepare("UPDATE users SET otp = ? WHERE email = ?");
$stmt->bind_param("ss", $otp, $email);
$stmt->execute();

// Send OTP email using PHPMailer
$email_sent = sendOTPEmail($email, $otp, 'login', $user_name);
if (!$email_sent) {
    error_log("Failed to send OTP email to: $email");
    // Email failed but OTP is in database, user can still try to use it
}

// Save in session
$_SESSION['otp_email'] = $email;
$_SESSION['otp_purpose'] = 'login';

// Redirect to OTP page
header("Location: login_otp.php");
exit;
?>