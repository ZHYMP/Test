// ========================= SIDEBAR TOGGLE =========================
const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");

sidebarToggler.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});

// ========================= LIVE DATE & TIME UPDATE =========================
function updateDateTime() {
  const now = new Date();
  const dateOptions = { month: "long", day: "numeric", weekday: "long" };
  const timeOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  const dateString = now.toLocaleDateString("en-US", dateOptions);
  const timeString = now.toLocaleTimeString("en-US", timeOptions);
  document.getElementById("datetimeDisplay").textContent =
    `${dateString} | ${timeString}`;
}

updateDateTime();
setInterval(updateDateTime, 1000);

// ========================= STATE & ELEMENTS =========================
const USERS_API = "../api/users/index.php";
let usersData = [];
let currentEditingUserId = null;

// Table elements
const tableBody = document.getElementById("usersTableBody");

// User modal elements
const userModal = document.getElementById("userModal");
const userForm = document.getElementById("userForm");
const modalTitle = document.getElementById("modalTitle");
const closeModal = document.getElementById("closeModal");
const cancelBtn = document.getElementById("cancelBtn");
const submitBtn = document.getElementById("submitBtn");
const addUserBtn = document.getElementById("addUserBtn");

// Form inputs
const userName = document.getElementById("userName");
const userUsername = document.getElementById("userUsername");
const userEmail = document.getElementById("userEmail");
const userDepartment = document.getElementById("userDepartment");
const userPassword = document.getElementById("userPassword");
const userSignatory = document.getElementById("userSignatory");
const passwordRequired = document.getElementById("passwordRequired");
const passwordHint = document.getElementById("passwordHint");

// Delete modal elements
const deleteModal = document.getElementById("deleteModal");
const closeDeleteModal = document.getElementById("closeDeleteModal");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const deleteName = document.getElementById("deleteName");
const deleteEmail = document.getElementById("deleteEmail");

// Toast elements
const toast = document.getElementById("toast");
const toastIcon = document.getElementById("toastIcon");
const toastMessage = document.getElementById("toastMessage");

// ========================= TOAST NOTIFICATION =========================
function showToast(message, type = "success") {
  toastMessage.textContent = message;
  toast.className = "toast show " + type;

  if (type === "success") {
    toastIcon.textContent = "check_circle";
  } else if (type === "error") {
    toastIcon.textContent = "error";
  }

  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// ========================= TABLE RENDERING =========================
function setTablePlaceholder(message) {
  tableBody.innerHTML = `<tr class="placeholder-row"><td colspan="5">${message}</td></tr>`;
}

// ========================= RENDER TABLE ROWS =========================
function renderUserRows(users) {
  // Clear existing content (including placeholder)
  tableBody.innerHTML = "";

  // Filter to show only employee users (exclude admins)
  const employeeUsers = users.filter((user) => user.role !== "admin");

  // If no users, show a message
  if (employeeUsers.length === 0) {
    tableBody.innerHTML =
      '<tr class="placeholder-row"><td colspan="5">No users found.</td></tr>';
    return;
  }

  // Render each user as a table row
  employeeUsers.forEach((user) => {
    const row = document.createElement("tr");
    row.setAttribute("data-user-id", user.id);

    const signatoryBadge = user.isSignatory
      ? '<img src="../assets/signatory.svg" alt="Signatory" class="signatory-badge" title="Authorized Signatory">'
      : "";

    row.innerHTML = `
      <td>
        <div class="name-cell">
          ${user.name}
          ${signatoryBadge}
        </div>
      </td>
      <td>${user.department || "-"}</td>
      <td>${user.email}</td>
      <td>${user.dateCreated}</td>
      <td>
        <div class="actions-cell">
          <span class="action-icon edit" data-action="edit" data-user-id="${user.id}">
            <span class="material-symbols-rounded">edit</span>
          </span>
          <span class="action-icon delete" data-action="delete" data-user-id="${user.id}">
            <span class="material-symbols-rounded">delete</span>
          </span>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });

  // Attach event listeners to action buttons
  attachActionListeners();
}

// ========================= ACTION BUTTON HANDLERS =========================
function attachActionListeners() {
  // Edit buttons
  document.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener("click", function () {
      const userId = this.getAttribute("data-user-id");
      openEditModal(userId);
    });
  });

  // Delete buttons
  document.querySelectorAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener("click", function () {
      const userId = this.getAttribute("data-user-id");
      openDeleteModal(userId);
    });
  });
}

// ========================= FETCH USERS =========================
async function fetchUsers() {
  setTablePlaceholder("Loading users...");

  try {
    const response = await fetch(USERS_API, {
      headers: { "Cache-Control": "no-cache" },
    });
    const data = await response.json();

    if (response.ok && Array.isArray(data)) {
      usersData = data.map((user) => ({
        ...user,
        isSignatory: Boolean(user.isSignatory),
      }));
      renderUserRows(usersData);
      return;
    }

    const errorMessage = data?.error || "Unexpected response from server.";
    setTablePlaceholder(errorMessage);
  } catch (error) {
    setTablePlaceholder("Error loading users. Please try again.");
  }
}

// ========================= MODAL MANAGEMENT =========================
function openAddModal() {
  currentEditingUserId = null;
  modalTitle.textContent = "Add New User";
  submitBtn.innerHTML =
    '<span class="material-symbols-rounded">save</span> Save User';

  // Reset form
  userForm.reset();

  // Show password as required
  passwordRequired.style.display = "inline";
  passwordHint.classList.remove("show");
  userPassword.required = true;

  // Show modal
  userModal.classList.add("active");
  userName.focus();
}

function openEditModal(userId) {
  const user = usersData.find((u) => u.id == userId);

  if (!user) {
    showToast("User not found!", "error");
    return;
  }

  currentEditingUserId = userId;
  modalTitle.textContent = "Edit User";
  submitBtn.innerHTML =
    '<span class="material-symbols-rounded">save</span> Update User';

  // Populate form
  userName.value = user.name;
  userUsername.value = user.username || "";
  userEmail.value = user.email;
  userDepartment.value = user.department || "";
  userPassword.value = "";
  userSignatory.checked = user.isSignatory;

  // Password is optional for edit
  passwordRequired.style.display = "none";
  passwordHint.classList.add("show");
  userPassword.required = false;

  // Show modal
  userModal.classList.add("active");
  userName.focus();
}

function closeUserModal() {
  userModal.classList.remove("active");
  userForm.reset();
  currentEditingUserId = null;
}

function openDeleteModal(userId) {
  const user = usersData.find((u) => u.id == userId);

  if (!user) {
    showToast("User not found!", "error");
    return;
  }

  deleteName.textContent = user.name;
  deleteEmail.textContent = user.email;
  confirmDeleteBtn.setAttribute("data-user-id", userId);

  deleteModal.classList.add("active");
}

function closeDeleteModalFn() {
  deleteModal.classList.remove("active");
  confirmDeleteBtn.removeAttribute("data-user-id");
}

// ========================= FORM SUBMISSION =========================
userForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = {
    name: userName.value.trim(),
    username: userUsername.value.trim(),
    email: userEmail.value.trim(),
    department: userDepartment.value.trim(),
    role: "employee",
    isSignatory: userSignatory.checked,
  };

  // Add password if provided
  if (userPassword.value) {
    formData.password = userPassword.value;
  }

  // Validation
  if (
    !formData.name ||
    !formData.username ||
    !formData.email ||
    !formData.department
  ) {
    showToast("Please fill in all required fields", "error");
    return;
  }

  if (!currentEditingUserId && !formData.password) {
    showToast("Password is required for new users", "error");
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    showToast("Please enter a valid email address", "error");
    return;
  }

  // Disable submit button
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    let response;

    if (currentEditingUserId) {
      // Update existing user
      response = await fetch(`${USERS_API}?id=${currentEditingUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    } else {
      // Create new user
      response = await fetch(USERS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    }

    const data = await response.json();

    if (!response.ok || data.success === false) {
      showToast(data.error || "Failed to save user", "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = currentEditingUserId
        ? '<span class="material-symbols-rounded">save</span> Update User'
        : '<span class="material-symbols-rounded">save</span> Save User';
      return;
    }

    if (data.user) {
      if (currentEditingUserId) {
        // Update in local array
        const index = usersData.findIndex((u) => u.id == currentEditingUserId);
        if (index > -1) {
          usersData[index] = data.user;
        }
        showToast(`User "${data.user.name}" updated successfully!`, "success");
      } else {
        // Add to local array
        usersData.unshift(data.user);
        showToast(`User "${data.user.name}" created successfully!`, "success");
      }

      renderUserRows(usersData);
      closeUserModal();
    }
  } catch (error) {
    showToast("Could not save user. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = currentEditingUserId
      ? '<span class="material-symbols-rounded">save</span> Update User'
      : '<span class="material-symbols-rounded">save</span> Save User';
  }
});

// ========================= DELETE USER =========================
confirmDeleteBtn.addEventListener("click", async () => {
  const userId = confirmDeleteBtn.getAttribute("data-user-id");

  if (!userId) return;

  const user = usersData.find((u) => u.id == userId);

  // Disable button
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = "Deleting...";

  try {
    const response = await fetch(`${USERS_API}?id=${userId}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok || data.success === false) {
      showToast(data.error || "Failed to delete user", "error");
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.innerHTML =
        '<span class="material-symbols-rounded">delete</span> Delete User';
      return;
    }

    usersData = usersData.filter((u) => u.id != userId);
    renderUserRows(usersData);
    showToast(`User "${user.name}" deleted successfully!`, "success");
    closeDeleteModalFn();
  } catch (error) {
    showToast("Could not delete user. Please try again.", "error");
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.innerHTML =
      '<span class="material-symbols-rounded">delete</span> Delete User';
  }
});

// ========================= EVENT LISTENERS =========================
addUserBtn.addEventListener("click", openAddModal);
closeModal.addEventListener("click", closeUserModal);
cancelBtn.addEventListener("click", closeUserModal);
closeDeleteModal.addEventListener("click", closeDeleteModalFn);
cancelDeleteBtn.addEventListener("click", closeDeleteModalFn);

// Close modals on outside click
userModal.addEventListener("click", (e) => {
  if (e.target === userModal) {
    closeUserModal();
  }
});

deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) {
    closeDeleteModalFn();
  }
});

// Close modals on ESC key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (userModal.classList.contains("active")) {
      closeUserModal();
    }
    if (deleteModal.classList.contains("active")) {
      closeDeleteModalFn();
    }
  }
});

// ========================= INITIALIZE =========================
fetchUsers();
