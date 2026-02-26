<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OTP Verification</title>
    <link rel="stylesheet" href="../otp_email/otp_email.css">
</head>

<body>

    <div class="solid-circles">
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
        <div class="solid"></div>
    </div>

    <div class="blue-circles">
        <div class="blue"></div>
        <div class="blue"></div>
        <div class="blue"></div>
        <div class="blue"></div>
        <div class="blue"></div>
    </div>

    <div class="light-circles">
        <div class="light"></div>
        <div class="light"></div>
        <div class="light"></div>
        <div class="light"></div>
        <div class="light"></div>
        <div class="light"></div>
        <div class="light"></div>
        <div class="light"></div>
        <div class="light"></div>
        <div class="light"></div>
        <div class="light"></div>
    </div>

    <div class="blur-circles">
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
        <div class="blur"></div>
    </div>

    </div>

    <div class="left">
        <div class="logo">
            <img src="../assets/logo.png">
        </div>
    </div>

    <div class="right">
        <h2>OTP Verification</h2>

        <?php 
        require_once '../session_config.php';
        session_start();
        if (isset($_SESSION['otp_error'])) { 
            echo '<p class="error-message">' . $_SESSION['otp_error'] . '</p>'; 
            unset($_SESSION['otp_error']); 
        } 
        
        // Dynamic message for login
        $purposeMessage = 'We\'ve sent a 6-digit OTP to your email to complete your login.';
        ?>

<div class="otp-messages">
    <p id="otp-message"><?php echo $purposeMessage; ?></p>
    <p id="user-email"><?php echo $_SESSION['otp_email'] ?? 'example@gmail.com'; ?></p>
</div>


<form action="login_verify_otp.php" method="POST" id="otp-form">
    <div class="otp-inputs">
        <input type="text" maxlength="1" class="otp">
        <input type="text" maxlength="1" class="otp">
        <input type="text" maxlength="1" class="otp">
        <input type="text" maxlength="1" class="otp">
        <input type="text" maxlength="1" class="otp">
        <input type="text" maxlength="1" class="otp">
    </div>
    <input type="hidden" name="otp" id="otpValue">

    <button type="submit">Verify OTP</button>
</form>



<script src="../otp_email/otp_email.js"></script>


    </div>

</body>

</html>