// ========================= SIDEBAR TOGGLE =========================
const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");

sidebarToggler.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});

// ========================= DATE & TIME =========================
function updateDateTime() {
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const dateStr = now.toLocaleDateString("en-US", options);
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  document.getElementById("datetimeDisplay").textContent =
    `${dateStr} | ${timeStr}`;
}

updateDateTime();
setInterval(updateDateTime, 1000);

// ========================= PROFILE DATA =========================
let currentUser = null;
let isEditMode = false;

// Load user profile data
async function loadUserProfile() {
  try {
    const response = await fetch("../api/users/me.php");
    if (!response.ok) {
      throw new Error("Failed to fetch user data");
    }
    currentUser = await response.json();
    displayUserProfile();
  } catch (error) {
    console.error("Error loading profile:", error);
    showToast("Failed to load profile data", "error");
  }
}

// Display user profile
function displayUserProfile() {
  if (!currentUser) return;

  document.getElementById("userName").textContent = currentUser.name;
  document.getElementById("inputName").value = currentUser.name;
  document.getElementById("inputUsername").value = currentUser.username || "";
  document.getElementById("inputEmail").value = currentUser.email;
  document.getElementById("inputDepartment").value =
    currentUser.department || "";

  // Update role display
  const roleText = currentUser.role === "admin" ? "Administrator" : "Employee";
  document.getElementById("userRole").textContent = roleText;
}

// Load profile on page load
loadUserProfile();

// ========================= EDIT MODE =========================
const btnEditInfo = document.getElementById("btnEditInfo");
const btnCancel = document.getElementById("btnCancel");
const profileForm = document.getElementById("profileForm");
const formActions = document.getElementById("formActions");

const formInputs = [
  document.getElementById("inputName"),
  document.getElementById("inputUsername"),
  document.getElementById("inputEmail"),
];

// Department is always disabled for employees
const departmentInput = document.getElementById("inputDepartment");

// Toggle edit mode
btnEditInfo.addEventListener("click", () => {
  isEditMode = true;
  enableEditMode();
});

function enableEditMode() {
  formInputs.forEach((input) => {
    input.disabled = false;
    input.classList.add("enabled");
  });
  formActions.style.display = "flex";
  btnEditInfo.style.display = "none";
}

function disableEditMode() {
  isEditMode = false;
  formInputs.forEach((input) => {
    input.disabled = true;
    input.classList.remove("enabled");
  });
  formActions.style.display = "none";
  btnEditInfo.style.display = "flex";

  // Restore original values
  if (currentUser) {
    displayUserProfile();
  }
}

// Cancel edit
btnCancel.addEventListener("click", () => {
  disableEditMode();
});

// ========================= UPDATE PROFILE =========================
profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!isEditMode) return;

  // Department is fixed for employees, not included in update
  const formData = {
    name: document.getElementById("inputName").value.trim(),
    username: document.getElementById("inputUsername").value.trim(),
    email: document.getElementById("inputEmail").value.trim(),
  };

  // Validation
  if (!formData.name || !formData.username || !formData.email) {
    showToast("Please fill in all required fields", "error");
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    showToast("Please enter a valid email address", "error");
    return;
  }

  try {
    const response = await fetch("../api/users/update_profile.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      currentUser = { ...currentUser, ...formData };
      displayUserProfile();
      disableEditMode();
      showToast("Profile updated successfully", "success");
    } else {
      throw new Error(result.error || "Failed to update profile");
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    showToast(error.message || "Failed to update profile", "error");
  }
});

// ========================= PASSWORD TOGGLE =========================
document.querySelectorAll(".btn-toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-target");
    const input = document.getElementById(targetId);
    const icon = btn.querySelector(".material-symbols-rounded");

    if (input.type === "password") {
      input.type = "text";
      icon.textContent = "visibility_off";
    } else {
      input.type = "password";
      icon.textContent = "visibility";
    }
  });
});

// ========================= CHANGE PASSWORD =========================
const passwordForm = document.getElementById("passwordForm");

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById("inputCurrentPassword").value;
  const newPassword = document.getElementById("inputNewPassword").value;
  const confirmPassword = document.getElementById("inputConfirmPassword").value;

  // Validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast("Please fill in all password fields", "error");
    return;
  }

  if (newPassword.length < 6) {
    showToast("New password must be at least 6 characters", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match", "error");
    return;
  }

  if (currentPassword === newPassword) {
    showToast("New password must be different from current password", "error");
    return;
  }

  try {
    const response = await fetch("../api/users/change_password.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      passwordForm.reset();
      showToast("Password changed successfully", "success");
    } else {
      throw new Error(result.error || "Failed to change password");
    }
  } catch (error) {
    console.error("Error changing password:", error);
    showToast(error.message || "Failed to change password", "error");
  }
});

// ========================= TOAST NOTIFICATION =========================
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type}`;

  // Show toast
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // Hide toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
