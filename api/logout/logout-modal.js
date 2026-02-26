// ========================= LOGOUT MODAL =========================
// Reusable logout modal functionality

function initLogoutModal() {
  const logoutModal = document.getElementById("logoutModal");
  const logoutOverlay = document.querySelector(".logout-modal-overlay");
  const logoutClose = document.querySelector(".logout-modal-close");
  const logoutCancel = document.getElementById("btnLogoutCancel");
  const logoutConfirm = document.getElementById("btnLogoutConfirm");

  // Find all logout links
  const logoutLinks = document.querySelectorAll('a[href="#"]');
  logoutLinks.forEach((link) => {
    const label = link.querySelector(".nav-label");
    if (label && label.textContent === "Logout") {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        openLogoutModal();
      });
    }
  });

  function openLogoutModal() {
    logoutModal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeLogoutModal() {
    logoutModal.classList.remove("active");
    document.body.style.overflow = "";
  }

  // Close modal handlers
  if (logoutClose) {
    logoutClose.addEventListener("click", closeLogoutModal);
  }

  if (logoutOverlay) {
    logoutOverlay.addEventListener("click", closeLogoutModal);
  }

  if (logoutCancel) {
    logoutCancel.addEventListener("click", closeLogoutModal);
  }

  // Confirm logout
  if (logoutConfirm) {
    logoutConfirm.addEventListener("click", () => {
      // Redirect to login page to logout
      window.location.href = "../login/login.php";
    });
  }

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && logoutModal.classList.contains("active")) {
      closeLogoutModal();
    }
  });
}

// Initialize on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLogoutModal);
} else {
  initLogoutModal();
}
