document
  .getElementById("signupForm")
  .addEventListener("submit", function (event) {
    const name = document.getElementById("name").value.trim();
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document
      .getElementById("confirm_password")
      .value.trim();

    if (!name || !username || !email || !password || !confirmPassword) {
      alert("Please fill in all required fields.");
      event.preventDefault(); // STOP form submission
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      event.preventDefault();
      return;
    }
  });
