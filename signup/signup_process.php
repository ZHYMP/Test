<?php
require_once '../session_config.php';
session_start();

include '../database.php';
include '../mailer_config.php';

if (!$conn) {
    die("Database connection failed");
}

// Receive form data
$name     = $_POST['name'];
$username = $_POST['username'];
$email    = $_POST['email'];
$password = password_hash($_POST['password'], PASSWORD_BCRYPT);
$role     = 'admin';
$department = 'Management'; // Default department for admin
$is_signatory = 1; // Admin is signatory by default

// Check if admin already exists
$stmt = $conn->prepare("SELECT id FROM users WHERE role = 'admin'");
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows > 0) {
    die("Admin account already exists. Signup is one-time only.");
}

// Check if username or email already exists
$stmt = $conn->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
$stmt->bind_param("ss", $username, $email);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows > 0) {
    die("Username or email already exists.");
}

// Generate 6-digit OTP (000000–999999)
$otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

// Insert user WITH OTP
$stmt = $conn->prepare(
    "INSERT INTO users (name, username, email, password, role, department, is_signatory, otp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

$stmt->bind_param("ssssssis", $name, $username, $email, $password, $role, $department, $is_signatory, $otp);
if (!$stmt->execute()) {
    die("Error inserting user: " . $stmt->error);
}

// Send OTP email using PHPMailer
if (!sendOTPEmail($email, $otp, 'signup', $name)) {
    // If mail fails, log the error but continue
    error_log("Failed to send OTP email to: $email");
}

// Save email in session for OTP verification
$_SESSION['otp_email'] = $email;
$_SESSION['otp_purpose'] = 'signup';

// Redirect to OTP page
header("Location: ../otp_email/otp_email.php");
exit;
