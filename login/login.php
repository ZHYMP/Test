<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Log In</title>
    <link rel="stylesheet" href="../login/login.css">
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
        <h2 style="margin-left: 170px; margin-bottom: 15px;">Welcome Back!</h2>

        <?php require_once '../session_config.php'; session_start(); if (isset($_SESSION['login_error'])) { echo '<p style="color: red; text-align: center; margin-bottom: 10px;">' . $_SESSION['login_error'] . '</p>'; unset($_SESSION['login_error']); } if (isset($_SESSION['signup_success'])) { echo '<p style="color: green; text-align: center;">' . $_SESSION['signup_success'] . '</p>'; unset($_SESSION['signup_success']); } ?>

        <form action="login_process.php" method="POST">
            <div class="form-group">
                <label>Username / Email</label>
                <input type="text" name="user_input" placeholder="Enter your username / email" required>
            </div>

            <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" placeholder="Enter your password" required>
            </div>

            <div class="forgot-password">
                <a href="../forgot_password/forgot_pass.html">Forgot Password?</a>
            </div>

            <button type="submit">Log In</button>
        </form>

    </div>

</body>

</html>