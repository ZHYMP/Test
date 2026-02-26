// Get the email from localStorage, or use example@gmail.com as default
// const email = localStorage.getItem("otpEmail") || "example@gmail.com";

// Display the email in the paragraph below the message
// document.getElementById("user-email").innerText = email;

// Auto-focus for OTP inputs
const inputs = document.querySelectorAll(".otp");
inputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    if (input.value.length === 1 && index < inputs.length - 1) {
      inputs[index + 1].focus();
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && index > 0 && !input.value) {
      inputs[index - 1].focus();
    }
  });
});

// OTP submission
document.getElementById("otp-form").addEventListener("submit", (e) => {
  const otpValue = Array.from(inputs)
    .map((i) => i.value)
    .join("");
  document.getElementById("otpValue").value = otpValue;

  if (otpValue.length !== 6) {
    alert("Please enter all 6 digits of the OTP.");
    e.preventDefault();
    return;
  }
});
