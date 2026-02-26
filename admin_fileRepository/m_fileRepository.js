// ========================= INITIALIZATION =========================

const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");

// Sidebar toggle
sidebarToggler.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});

// Date & Time Display
function updateDateTime() {
  const now = new Date();
  const options = { month: "long", day: "numeric", weekday: "long" };
  const dateStr = now.toLocaleDateString("en-US", options);
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  document.getElementById("datetimeDisplay").textContent =
    `${dateStr} | ${timeStr}`;
}

updateDateTime();
setInterval(updateDateTime, 1000);

// Check document preview libraries
console.log("Document preview libraries loaded:", {
  pdfjsLib: typeof pdfjsLib !== "undefined",
  mammoth: typeof mammoth !== "undefined",
  XLSX: typeof XLSX !== "undefined",
});

// ========================= UTILITY FUNCTIONS =========================

// Extract file extension from filename
function getFileExtension(filename) {
  if (!filename) return "file";

  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "docx";
  if (ext === "xls" || ext === "xlsx") return "xlsx";
  if (ext === "ppt" || ext === "pptx") return "pptx";
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return ext;
  if (["txt", "csv", "log", "json", "xml"].includes(ext)) return ext;
  return "file";
}

// ========================= STATE MANAGEMENT =========================

let state = {
  folders: [],
  recentFiles: [],
  allFiles: [],
  departments: [],
  selectedFolderId: null,
  selectedFileId: null,
  currentFolderForPermissions: null,
  selectedEmployeesForPermissions: [],
  selectedFilesForFolder: [],
  uploadedFiles: [],
  approvedFiles: [],
  filteredApprovedFiles: [],
};

// ========================= API CALLS =========================

// Fetch folders from database
async function fetchFolders() {
  try {
    const response = await fetch("../api/folders/index.php", { method: "GET" });
    const data = await response.json();
    if (data.success) {
      state.folders = data.folders || [];
      // Don't auto-select - user must manually select a folder
      renderFolders();
    } else {
      console.error("Error fetching folders:", data.error);
      state.folders = [];
      renderFolders();
    }
  } catch (error) {
    console.error("Error fetching folders:", error);
    // Fallback to empty folders
    state.folders = [];
    renderFolders();
  }
}

// Fetch recent files from database (only approved, limit 3)
// Fetch all repository files (for folder view)
async function fetchAllRepositoryFiles() {
  try {
    console.log("Fetching all repository files...");
    const response = await fetch("../api/files/repository.php", {
      method: "GET",
    });
    const data = await response.json();
    console.log("Repository files API response:", data);

    if (data.success && Array.isArray(data.files)) {
      state.allFiles = data.files;
      console.log("All repository files loaded:", state.allFiles.length);
    } else {
      console.error("Error fetching repository files:", data);
      state.allFiles = [];
    }
  } catch (error) {
    console.error("Error fetching repository files:", error);
    state.allFiles = [];
  }
}

// Fetch recent files (for recent files section - limit 3)
async function fetchRecentFiles() {
  try {
    console.log("Fetching recent files...");
    const response = await fetch("../api/files/repository.php", {
      method: "GET",
    });
    const data = await response.json();
    console.log("Files API response:", data);

    if (data.success && Array.isArray(data.files)) {
      // Only take first 3 files for recent files section
      state.recentFiles = data.files.slice(0, 3);
      console.log("Recent files loaded:", state.recentFiles.length);
      renderRecentFiles();
    } else {
      console.error("Error fetching recent files:", data);
      state.recentFiles = [];
      renderRecentFiles();
    }
  } catch (error) {
    console.error("Error fetching recent files:", error);
    state.recentFiles = [];
    renderRecentFiles();
  }
}

// Fetch departments for permissions
async function fetchDepartments() {
  try {
    const response = await fetch("../api/folders/permissions.php", {
      method: "GET",
    });
    const data = await response.json();
    state.departments = data.departments || [];
    populateDepartmentSelect();
  } catch (error) {
    console.error("Error fetching departments:", error);
    state.departments = [];
  }
}

// Fetch approved files
async function fetchApprovedFiles() {
  try {
    const response = await fetch(
      "../api/documents/pending.php?status=approved",
      {
        method: "GET",
      },
    );
    const data = await response.json();
    console.log("Approved files response:", data);

    // API returns plain array, not {success: true, documents: []}
    if (Array.isArray(data)) {
      state.approvedFiles = data;
      state.filteredApprovedFiles = [...state.approvedFiles];
      console.log("Loaded approved files:", state.approvedFiles.length);
    } else {
      state.approvedFiles = [];
      state.filteredApprovedFiles = [];
    }
  } catch (error) {
    console.error("Error fetching approved files:", error);
    state.approvedFiles = [];
    state.filteredApprovedFiles = [];
  }
}

// Create folder
async function createFolder(folderName) {
  try {
    const response = await fetch("../api/folders/index.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName }),
    });
    const data = await response.json();
    if (data.success) {
      await fetchFolders();
      closeModal("createFolderModal");
      document.getElementById("folderName").value = "";
      showToast("Folder created successfully", "success");
    } else {
      showToast(data.error || "Failed to create folder", "error");
    }
  } catch (error) {
    console.error("Error creating folder:", error);
    showToast("Failed to create folder", "error");
  }
}

// Update folder
async function updateFolder(folderId, folderName) {
  try {
    const response = await fetch("../api/folders/index.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: folderId,
        name: folderName,
        action: "update",
      }),
    });
    const data = await response.json();
    if (data.success) {
      await fetchFolders();
      closeModal("editFolderModal");
      showToast("Folder updated successfully", "success");
    }
  } catch (error) {
    console.error("Error updating folder:", error);
    showToast("Failed to update folder", "error");
  }
}

// Delete folder
async function deleteFolder(folderId) {
  try {
    const response = await fetch("../api/folders/index.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: folderId, action: "delete" }),
    });
    const data = await response.json();
    if (data.success) {
      await fetchFolders();
      showToast("Folder deleted successfully", "success");
    } else {
      showToast(data.error || "Failed to delete folder", "error");
    }
  } catch (error) {
    console.error("Error deleting folder:", error);
    showToast("Failed to delete folder", "error");
  }
}

// Get employees by department
async function getEmployeesByDepartment(department) {
  try {
    const response = await fetch("../api/folders/permissions.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_department_users", department }),
    });
    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
}

// Save folder permissions (for editing existing folder permissions)
async function saveFolderPermissions(folderId, employeeIds) {
  try {
    const response = await fetch("../api/folders/permissions.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_folder_permissions",
        folderId: folderId,
        permissions: employeeIds,
      }),
    });
    const data = await response.json();
    if (data.success) {
      closeModal("folderPermissionsModal");
      showToast("Permissions saved successfully", "success");
    } else {
      showToast(data.error || "Failed to save permissions", "error");
    }
  } catch (error) {
    console.error("Error saving permissions:", error);
    showToast("Failed to save permissions", "error");
  }
}

// Set initial folder permissions (for new folder creation)
async function setInitialFolderPermissions(folderId, employeeIds) {
  try {
    const response = await fetch("../api/folders/permissions.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_folder_permissions",
        folderId: folderId,
        permissions: employeeIds,
      }),
    });
    const data = await response.json();
    return data; // Return the result to the caller
  } catch (error) {
    console.error("Error setting initial permissions:", error);
    return { success: false, error: error.message };
  }
}

// ========================= MODAL MANAGEMENT =========================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
  }
}

// Close modals
document.querySelectorAll(".modal").forEach((modal) => {
  // Close button
  const closeBtn = modal.querySelector(".modal-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeModal(modal.id));
  }

  // Close on overlay click
  const overlay = modal.querySelector(".modal-overlay");
  if (overlay) {
    overlay.addEventListener("click", () => closeModal(modal.id));
  }

  // Close on data-modal button click
  modal.querySelectorAll("[data-modal]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal]")) {
        closeModal(modal.id);
      }
    });
  });
});

// ========================= RENDERING FUNCTIONS =========================

// Render folders list
function renderFolders() {
  const folderList = document.getElementById("folderList");
  folderList.innerHTML = "";

  state.folders.forEach((folder) => {
    const folderItem = document.createElement("div");
    folderItem.className = `folder-item ${
      folder.id === state.selectedFolderId ? "active" : ""
    }`;
    folderItem.innerHTML = `
      <span class="folder-icon material-symbols-rounded">folder</span>
      <span class="folder-name">${folder.name}</span>
      <span class="folder-menu material-symbols-rounded" data-folder-id="${folder.id}">more_vert</span>
    `;

    // Click to select folder
    folderItem.addEventListener("click", () => {
      state.selectedFolderId = folder.id;
      renderFolders();
      renderFilesForSelectedFolder();
    });

    // Menu button
    const menuBtn = folderItem.querySelector(".folder-menu");
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openFolderMenu(folder);
    });

    folderList.appendChild(folderItem);
  });

  // If no folders, show empty message
  if (state.folders.length === 0) {
    folderList.innerHTML =
      '<div class="placeholder-text">No folders yet. Create one!</div>';
  }
}

// Render recent files
function renderRecentFiles() {
  const recentFilesRow = document.getElementById("recentFilesRow");
  recentFilesRow.innerHTML = "";

  console.log("Rendering recent files, count:", state.recentFiles.length);

  if (state.recentFiles.length === 0) {
    recentFilesRow.innerHTML =
      '<div class="placeholder-text">No recent files</div>';
    return;
  }

  state.recentFiles.forEach((file) => {
    const fileCard = document.createElement("div");
    fileCard.className = `recent-file-card ${
      file.id === state.selectedFileId ? "active" : ""
    }`;

    const iconClass = file.type || "pdf";
    fileCard.innerHTML = `
      <div class="recent-file-header">
        <div class="recent-file-icon ${iconClass}">
          <span class="material-symbols-rounded">description</span>
        </div>
        <div class="recent-file-info">
          <h4 class="recent-file-name">${file.fileName}</h4>
          <p class="recent-file-size">${file.size || "Unknown"}</p>
        </div>
      </div>
      <div class="recent-file-meta">
        <span class="recent-file-owner">
          <span class="material-symbols-rounded" style="font-size: 14px;">person</span>
          ${file.owner || "Unknown"}
        </span>
        <span class="recent-file-date ${iconClass}">
          <span class="material-symbols-rounded" style="font-size: 14px;">calendar_today</span>
          ${file.dateUploaded || "N/A"}
        </span>
      </div>
    `;

    // Card click - open file details modal
    fileCard.addEventListener("click", () => {
      state.selectedFileId = file.id;
      showFileDetails(file);
    });

    recentFilesRow.appendChild(fileCard);
  });
}

// Render files for selected folder
function renderFilesForSelectedFolder() {
  const filesGrid = document.getElementById("filesGrid");
  filesGrid.innerHTML = "";

  const folderFiles = state.allFiles.filter(
    (f) => f.folderId === state.selectedFolderId,
  );

  if (folderFiles.length === 0) {
    filesGrid.innerHTML =
      '<div class="placeholder-text">No files in this folder</div>';
    return;
  }

  folderFiles.forEach((file) => {
    const fileCard = document.createElement("div");
    fileCard.className = "file-card";

    const iconClass = file.type || "pdf";
    fileCard.innerHTML = `
      <button class="file-card-remove" data-file-id="${file.id}" title="Remove from folder">
        <span class="material-symbols-rounded">close</span>
      </button>
      <div class="file-card-icon ${iconClass} material-symbols-rounded">
        ${getFileIcon(iconClass)}
      </div>
      <p class="file-card-name" title="${file.fileName}">${file.fileName}</p>
    `;

    // Click on card to show details
    fileCard.addEventListener("click", (e) => {
      // Don't open details if clicking remove button
      if (e.target.closest(".file-card-remove")) return;
      showFileDetails(file);
    });

    // Remove button handler
    const removeBtn = fileCard.querySelector(".file-card-remove");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRemoveFileModal(file.id, file.fileName);
    });

    filesGrid.appendChild(fileCard);
  });
}

// Open remove file confirmation modal
function openRemoveFileModal(fileId, fileName) {
  state.selectedFileId = fileId;
  document.getElementById("removeFileName").textContent = fileName;
  openModal("removeFileModal");
}

// Remove file from folder (repository-specific function)
async function removeFileFromFolder(fileId) {
  try {
    const response = await fetch("../api/files/remove_from_folder.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileId }),
    });

    const result = await response.json();

    if (result.success) {
      showToast("File removed from folder successfully", "success");

      // Refresh the files display
      await fetchAllRepositoryFiles();
      await fetchRecentFiles();
      renderFilesForSelectedFolder();
    } else {
      showToast(result.error || "Failed to remove file from folder", "error");
    }
  } catch (error) {
    console.error("Error removing file from folder:", error);
    showToast("An error occurred while removing the file", "error");
  }
}

// Show file details in modal
function showFileDetails(file) {
  console.log("Showing file details for:", file);

  const container = document.getElementById("fileDetailsContainer");
  const iconClass = file.type || "pdf";
  const fileName = file.fileName || file.name || "Untitled";
  const fileSize = file.size || file.file_size || "Unknown";
  const owner = file.owner || "Unknown";
  const department = file.department || "N/A";
  const dateUploaded = file.dateUploaded || "N/A";

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
      <div class="file-icon-large ${iconClass} material-symbols-rounded">
        ${getFileIcon(iconClass)}
      </div>
      <div>
        <h3 style="margin: 0; font-size: 18px; color: var(--text-dark);">${fileName}</h3>
        <p style="margin: 4px 0 0 0; color: var(--text-light-gray);">${fileSize}</p>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-item">
        <span class="detail-label">Owner:</span>
        <span class="detail-value">${owner}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Department:</span>
        <span class="detail-value">${department}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Uploaded:</span>
        <span class="detail-value">${dateUploaded}</span>
      </div>
    </div>

    <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: center;">
      <button class="btn-view-document" data-file-id="${file.id}" style="padding: 12px 24px; background: #0461CE; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
        <span class="material-symbols-rounded">visibility</span>
        View Document
      </button>
    </div>
  `;

  openModal("fileDetailsModal");

  // Attach event listener to View Document button
  const viewBtn = container.querySelector(".btn-view-document");
  if (viewBtn) {
    viewBtn.addEventListener("click", () => {
      console.log("View Document button clicked");

      closeModal("fileDetailsModal");
      openRepoFilePreview(file);
    });
  }
}

// ========================= FOLDER MENU =========================

async function openFolderMenu(folder) {
  state.currentFolderForPermissions = folder;

  // Update modal title with folder name
  document.getElementById("folderMenuTitle").textContent = folder.name;

  openModal("folderMenuModal");

  // Fetch and display permissions
  await displayFolderPermissions(folder.id);

  // Button handlers
  document.getElementById("btnEditFolder").onclick = () => {
    closeModal("folderMenuModal");
    document.getElementById("editFolderName").value = folder.name;
    openModal("editFolderModal");
  };

  document.getElementById("btnSetPermissions").onclick = () => {
    closeModal("folderMenuModal");
    state.currentFolderForPermissions = folder;
    openModal("folderPermissionsModal");
  };

  document.getElementById("btnDeleteFolder").onclick = () => {
    closeModal("folderMenuModal");
    document.getElementById("deleteFolderName").textContent = folder.name;
    openModal("deleteFolderModal");

    // Set up confirm delete button
    document.getElementById("btnConfirmDelete").onclick = () => {
      deleteFolder(folder.id);
      closeModal("deleteFolderModal");
    };
  };
}

// Set up remove file confirmation button
document.getElementById("btnConfirmRemove").onclick = () => {
  if (state.selectedFileId) {
    removeFileFromFolder(state.selectedFileId);
    closeModal("removeFileModal");
  }
};

// Fetch and display folder permissions
async function displayFolderPermissions(folderId) {
  const permissionsList = document.getElementById("permissionsList");
  permissionsList.innerHTML =
    '<div class="loading-permissions">Loading permissions...</div>';

  try {
    const response = await fetch("../api/folders/permissions.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "get_folder_permissions",
        folderId: folderId,
      }),
    });
    const data = await response.json();

    if (data.success && data.permissions && data.permissions.length > 0) {
      permissionsList.innerHTML = "";
      data.permissions.forEach((user) => {
        const userItem = document.createElement("div");
        userItem.className = "permission-user";
        userItem.innerHTML = `
          <span class="material-symbols-rounded">person</span>
          <div class="permission-user-info">
            <span class="permission-user-name">${user.name}</span>
            <span class="permission-user-email">${user.email}</span>
          </div>
        `;
        permissionsList.appendChild(userItem);
      });
    } else {
      permissionsList.innerHTML =
        '<div class="no-permissions">No permissions set</div>';
    }
  } catch (error) {
    console.error("Error fetching permissions:", error);
    permissionsList.innerHTML =
      '<div class="no-permissions">Error loading permissions</div>';
  }
}

// ========================= FORM HANDLERS =========================

// Validate create folder form and enable/disable submit button
function validateCreateFolderForm() {
  const folderName = document.getElementById("folderName").value.trim();
  const department = document.getElementById("createDepartmentSelect").value;
  const hasPermissions = state.selectedEmployeesForPermissions.length > 0;
  const submitButton = document.getElementById("btnSubmitCreateFolder");

  // Enable button only if all requirements are met
  if (folderName && department && hasPermissions) {
    submitButton.disabled = false;
    submitButton.style.opacity = "1";
    submitButton.style.cursor = "pointer";
  } else {
    submitButton.disabled = true;
    submitButton.style.opacity = "0.5";
    submitButton.style.cursor = "not-allowed";
  }
}

// Create folder button
document.getElementById("btnCreateFolder").addEventListener("click", () => {
  openModal("createFolderModal");
  document.getElementById("folderName").value = "";
  document.getElementById("createDepartmentSelect").value = "";
  document.getElementById("createPermissionsSection").style.display = "none";
  state.selectedEmployeesForPermissions = [];

  // Reset and disable submit button
  const submitButton = document.getElementById("btnSubmitCreateFolder");
  submitButton.disabled = true;
  submitButton.style.opacity = "0.5";
  submitButton.style.cursor = "not-allowed";
});

// Folder name input validation
document.getElementById("folderName").addEventListener("input", () => {
  validateCreateFolderForm();
});

// Department selector for create folder permissions
document
  .getElementById("createDepartmentSelect")
  .addEventListener("change", async (e) => {
    const department = e.target.value;
    const select = e.target;
    const permissionsSection = document.getElementById(
      "createPermissionsSection",
    );

    if (department) {
      select.style.color = "#000000";
      permissionsSection.style.display = "block";
      const employees = await getEmployeesByDepartment(department);
      renderEmployeesListCreate(employees);
    } else {
      select.style.color = "";
      permissionsSection.style.display = "none";
      state.selectedEmployeesForPermissions = [];
    }

    // Validate form after department change
    validateCreateFolderForm();
  });

// Add file button
document.getElementById("btnAddFile").addEventListener("click", async () => {
  if (!state.selectedFolderId) {
    showToast("Please select a folder first", "warning");
    return;
  }

  // Reset state
  state.uploadedFiles = [];
  state.selectedFilesForFolder = [];
  document.getElementById("fileSearchInput").value = "";
  document.getElementById("uploadedFilesList").innerHTML = "";

  // Fetch approved files and render
  await fetchApprovedFiles();
  renderAvailableFiles();

  openModal("addFilesModal");
});

// Create folder form
document
  .getElementById("createFolderForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const folderName = document.getElementById("folderName").value.trim();
    const department = document.getElementById("createDepartmentSelect").value;

    if (!folderName) {
      showToast("Please enter a folder name", "warning");
      return;
    }

    if (!department) {
      showToast("Please select a department for permissions", "warning");
      return;
    }

    if (state.selectedEmployeesForPermissions.length === 0) {
      showToast(
        "Please select at least one employee for permissions",
        "warning",
      );
      return;
    }

    // Create folder first
    try {
      const response = await fetch("../api/folders/index.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: folderName }),
      });
      const data = await response.json();

      if (data.success) {
        // Set initial permissions for the newly created folder
        const permissionResult = await setInitialFolderPermissions(
          data.folder.id,
          state.selectedEmployeesForPermissions,
        );

        if (permissionResult.success) {
          // Success - close modal, reset form, and refresh
          closeModal("createFolderModal");
          showToast("Folder created with permissions successfully", "success");
          document.getElementById("folderName").value = "";
          document.getElementById("createDepartmentSelect").value = "";
          document.getElementById("createPermissionsSection").style.display =
            "none";
          state.selectedEmployeesForPermissions = [];
          await fetchFolders();
        } else {
          // Permissions failed - notify user
          showToast(
            permissionResult.error ||
              "Folder created but failed to set permissions. Please edit the folder to set permissions.",
            "warning",
          );
          // Still close the modal and refresh since folder was created
          closeModal("createFolderModal");
          document.getElementById("folderName").value = "";
          document.getElementById("createDepartmentSelect").value = "";
          document.getElementById("createPermissionsSection").style.display =
            "none";
          state.selectedEmployeesForPermissions = [];
          await fetchFolders();
        }
      } else {
        showToast(data.error || "Failed to create folder", "error");
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      showToast("Failed to create folder", "error");
    }
  });

// Edit folder form
document.getElementById("editFolderForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const folderName = document.getElementById("editFolderName").value.trim();
  if (folderName && state.currentFolderForPermissions) {
    updateFolder(state.currentFolderForPermissions.id, folderName);
  }
});

// Department selector for permissions
document
  .getElementById("departmentSelect")
  .addEventListener("change", async (e) => {
    const department = e.target.value;
    const select = e.target;

    // Change text color to black when a value is selected
    if (department) {
      select.style.color = "#000000";
      const employees = await getEmployeesByDepartment(department);
      renderEmployeesList(employees);
    } else {
      select.style.color = "";
    }
  });

// Render employees list for permissions
function renderEmployeesList(employees) {
  const employeesList = document.getElementById("employeesList");
  employeesList.innerHTML = "";

  if (employees.length === 0) {
    employeesList.innerHTML =
      '<div class="placeholder-text">No employees found</div>';
    return;
  }

  // Auto-select all employees
  const allEmployeeIds = employees.map((emp) => emp.id);
  state.selectedEmployeesForPermissions = [...allEmployeeIds];

  // Add select all checkbox
  const selectAllItem = document.createElement("div");
  selectAllItem.className = "select-all-item";
  selectAllItem.innerHTML = `
    <input type="checkbox" id="selectAllEmployees" checked>
    <label for="selectAllEmployees">
      <span class="material-symbols-rounded" style="font-size: 18px;">checklist</span>
      Select All
    </label>
  `;

  const selectAllCheckbox = selectAllItem.querySelector("input");
  selectAllCheckbox.addEventListener("change", (e) => {
    const allCheckboxes = employeesList.querySelectorAll(
      '.employee-item input[type="checkbox"]',
    );
    allCheckboxes.forEach((cb) => (cb.checked = e.target.checked));

    if (e.target.checked) {
      state.selectedEmployeesForPermissions = [...allEmployeeIds];
    } else {
      state.selectedEmployeesForPermissions = [];
    }
  });

  employeesList.appendChild(selectAllItem);

  // Render individual employees
  employees.forEach((employee) => {
    const isSelected = state.selectedEmployeesForPermissions.includes(
      employee.id,
    );
    const employeeItem = document.createElement("div");
    employeeItem.className = "employee-item";
    employeeItem.innerHTML = `
      <input type="checkbox" ${isSelected ? "checked" : ""} value="${
        employee.id
      }">
      <div class="employee-info">
        <span class="employee-name">${employee.name}</span>
        <span class="employee-email">${employee.email}</span>
      </div>
    `;

    const checkbox = employeeItem.querySelector("input");
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        if (!state.selectedEmployeesForPermissions.includes(employee.id)) {
          state.selectedEmployeesForPermissions.push(employee.id);
        }
      } else {
        state.selectedEmployeesForPermissions =
          state.selectedEmployeesForPermissions.filter(
            (id) => id !== employee.id,
          );
      }

      // Update select all checkbox
      selectAllCheckbox.checked =
        state.selectedEmployeesForPermissions.length === employees.length;
    });

    employeesList.appendChild(employeeItem);
  });
}

// Render employees list for create folder permissions
function renderEmployeesListCreate(employees) {
  const employeesList = document.getElementById("employeesListCreate");
  employeesList.innerHTML = "";

  if (employees.length === 0) {
    employeesList.innerHTML =
      '<div class="placeholder-text">No employees found</div>';
    return;
  }

  // Auto-select all employees
  const allEmployeeIds = employees.map((emp) => emp.id);
  state.selectedEmployeesForPermissions = [...allEmployeeIds];

  // Add select all checkbox
  const selectAllItem = document.createElement("div");
  selectAllItem.className = "select-all-item";
  selectAllItem.innerHTML = `
    <input type="checkbox" id="selectAllEmployeesCreate" checked>
    <label for="selectAllEmployeesCreate">
      <span class="material-symbols-rounded" style="font-size: 18px;">checklist</span>
      Select All
    </label>
  `;

  const selectAllCheckbox = selectAllItem.querySelector("input");
  selectAllCheckbox.addEventListener("change", (e) => {
    const allCheckboxes = employeesList.querySelectorAll(
      '.employee-item input[type="checkbox"]',
    );
    allCheckboxes.forEach((cb) => (cb.checked = e.target.checked));

    if (e.target.checked) {
      state.selectedEmployeesForPermissions = [...allEmployeeIds];
    } else {
      state.selectedEmployeesForPermissions = [];
    }

    // Validate form after selection change
    validateCreateFolderForm();
  });

  employeesList.appendChild(selectAllItem);

  // Render individual employees
  employees.forEach((employee) => {
    const isSelected = state.selectedEmployeesForPermissions.includes(
      employee.id,
    );
    const employeeItem = document.createElement("div");
    employeeItem.className = "employee-item";
    employeeItem.innerHTML = `
      <input type="checkbox" ${isSelected ? "checked" : ""} value="${
        employee.id
      }">
      <div class="employee-info">
        <span class="employee-name">${employee.name}</span>
        <span class="employee-email">${employee.email}</span>
      </div>
    `;

    const checkbox = employeeItem.querySelector("input");
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        if (!state.selectedEmployeesForPermissions.includes(employee.id)) {
          state.selectedEmployeesForPermissions.push(employee.id);
        }
      } else {
        state.selectedEmployeesForPermissions =
          state.selectedEmployeesForPermissions.filter(
            (id) => id !== employee.id,
          );
      }

      // Update select all checkbox
      selectAllCheckbox.checked =
        state.selectedEmployeesForPermissions.length === employees.length;

      // Validate form after selection change
      validateCreateFolderForm();
    });

    employeesList.appendChild(employeeItem);
  });

  // Initial validation after rendering employees
  validateCreateFolderForm();
}

// Populate department select
function populateDepartmentSelect() {
  const select = document.getElementById("departmentSelect");
  select.innerHTML = '<option value="">-- Select Department --</option>';

  // Add "All" option
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All";
  select.appendChild(allOption);

  state.departments.forEach((dept) => {
    const option = document.createElement("option");
    option.value = dept;
    option.textContent = dept;
    select.appendChild(option);
  });

  // Also populate the create folder department select
  const createSelect = document.getElementById("createDepartmentSelect");
  createSelect.innerHTML = '<option value="">-- Select Department --</option>';

  const allOptionCreate = document.createElement("option");
  allOptionCreate.value = "all";
  allOptionCreate.textContent = "All";
  createSelect.appendChild(allOptionCreate);

  state.departments.forEach((dept) => {
    const option = document.createElement("option");
    option.value = dept;
    option.textContent = dept;
    createSelect.appendChild(option);
  });
}

// Save permissions button
document.getElementById("btnSavePermissions").addEventListener("click", () => {
  // Get all checked checkboxes from the employees list
  const checkedBoxes = document.querySelectorAll(
    '#employeesList .employee-item input[type="checkbox"]:checked',
  );
  const selectedIds = Array.from(checkedBoxes).map((cb) => parseInt(cb.value));

  if (state.currentFolderForPermissions && selectedIds.length > 0) {
    saveFolderPermissions(state.currentFolderForPermissions.id, selectedIds);
    state.selectedEmployeesForPermissions = [];
  } else {
    showToast("Please select at least one employee", "warning");
  }
});

// File upload handler
document.getElementById("fileUpload").addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  files.forEach((file) => {
    if (!state.uploadedFiles.some((f) => f.name === file.name)) {
      state.uploadedFiles.push(file);
    }
  });
  renderUploadedFiles();
  e.target.value = ""; // Reset input
});

// File search handler
document.getElementById("fileSearchInput").addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase().trim();

  if (searchTerm === "") {
    state.filteredApprovedFiles = [...state.approvedFiles];
  } else {
    state.filteredApprovedFiles = state.approvedFiles.filter((file) => {
      const fileName = (file.fileName || file.name || "").toLowerCase();
      const owner = (file.owner || "").toLowerCase();
      return fileName.includes(searchTerm) || owner.includes(searchTerm);
    });
  }

  renderAvailableFiles();
});

// Confirm add files button
document
  .getElementById("btnConfirmAddFiles")
  .addEventListener("click", async () => {
    if (
      state.uploadedFiles.length === 0 &&
      state.selectedFilesForFolder.length === 0
    ) {
      showToast("Please select or upload at least one file", "warning");
      return;
    }

    // Check if a folder is selected
    if (!state.selectedFolderId) {
      showToast("Please select a folder first", "warning");
      return;
    }

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("folderId", state.selectedFolderId);

      // Add uploaded files
      state.uploadedFiles.forEach((file) => {
        formData.append("files[]", file);
      });

      // Add existing file IDs
      if (state.selectedFilesForFolder.length > 0) {
        formData.append(
          "existingFileIds",
          JSON.stringify(state.selectedFilesForFolder),
        );
      }

      // Send to server
      const response = await fetch("../api/files/add_to_folder.php", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        showToast(result.message || "Files added successfully", "success");

        // Clear state
        state.uploadedFiles = [];
        state.selectedFilesForFolder = [];

        // Close modal
        closeModal("addFilesModal");

        // Refresh folder display
        await fetchAllRepositoryFiles();
        await fetchRecentFiles();
        renderFilesForSelectedFolder();
      } else {
        showToast(result.error || "Failed to add files", "error");
      }
    } catch (error) {
      console.error("Error adding files:", error);
      showToast("An error occurred while adding files", "error");
    }
  });

// ========================= UTILITY FUNCTIONS =========================

// Render uploaded files
function renderUploadedFiles() {
  const uploadedFilesList = document.getElementById("uploadedFilesList");
  uploadedFilesList.innerHTML = "";

  state.uploadedFiles.forEach((file, index) => {
    const fileItem = document.createElement("div");
    fileItem.className = "uploaded-file-item";
    fileItem.innerHTML = `
      <span class="uploaded-file-name">${file.name}</span>
      <button class="btn-remove-upload" data-index="${index}">
        <span class="material-symbols-rounded">close</span>
      </button>
    `;

    const removeBtn = fileItem.querySelector(".btn-remove-upload");
    removeBtn.addEventListener("click", () => {
      state.uploadedFiles.splice(index, 1);
      renderUploadedFiles();
    });

    uploadedFilesList.appendChild(fileItem);
  });
}

// Render available approved files
function renderAvailableFiles() {
  const availableFilesList = document.getElementById("availableFilesList");
  availableFilesList.innerHTML = "";

  if (state.filteredApprovedFiles.length === 0) {
    availableFilesList.innerHTML =
      '<div class="placeholder-text">No approved files found</div>';
    return;
  }

  state.filteredApprovedFiles.forEach((file) => {
    const isSelected = state.selectedFilesForFolder.includes(file.id);
    const fileItem = document.createElement("div");
    fileItem.className = `file-item ${isSelected ? "selected" : ""}`;

    const fileType = file.type || file.fileName?.split(".").pop() || "pdf";
    fileItem.innerHTML = `
      <input type="checkbox" ${isSelected ? "checked" : ""} value="${file.id}">
      <div class="file-info">
        <span class="file-name">${file.fileName || file.name}</span>
        <span class="file-meta">${file.owner || "Unknown"} • ${file.dateUploaded || "N/A"}</span>
      </div>
    `;

    const checkbox = fileItem.querySelector("input");
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        if (!state.selectedFilesForFolder.includes(file.id)) {
          state.selectedFilesForFolder.push(file.id);
        }
        fileItem.classList.add("selected");
      } else {
        state.selectedFilesForFolder = state.selectedFilesForFolder.filter(
          (id) => id !== file.id,
        );
        fileItem.classList.remove("selected");
      }
    });

    availableFilesList.appendChild(fileItem);
  });
}

function getFileIcon(type) {
  const icons = {
    pdf: "picture_as_pdf",
    docx: "description",
    doc: "description",
    xlsx: "table_chart",
    xls: "table_chart",
  };
  return icons[type] || "description";
}

function getStatusClass(status) {
  const classes = {
    pending: "approval",
    "in-progress": "progress",
    approved: "approval",
    rejected: "review",
  };
  return classes[status] || "approval";
}

// ========================= TOAST NOTIFICATION =========================
const toast = document.getElementById("toast");
const toastIcon = document.getElementById("toastIcon");
const toastMessage = document.getElementById("toastMessage");

function showToast(message, type = "success") {
  toastMessage.textContent = message;
  toast.className = "toast show " + type;

  if (type === "success") {
    toastIcon.textContent = "check_circle";
  } else if (type === "error") {
    toastIcon.textContent = "error";
  } else if (type === "warning") {
    toastIcon.textContent = "warning";
  }

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// ========================= FILE PREVIEW FUNCTIONS (REPO-SPECIFIC) =========================

// Generate file preview content for repository files
function generateRepoFilePreview(file) {
  const fileName = file.fileName || file.name || "Untitled";
  // Try to get file type from API, fallback to extracting from filename
  const fileType = (file.type || getFileExtension(fileName)).toLowerCase();
  const fileId = file.id;

  console.log("Generating preview:", {
    fileName,
    fileId,
    fileType,
    fullFileObject: file,
  });

  // Use preview API endpoint for inline viewing
  const basePath = window.location.pathname.split("/")[1];
  // Add cache-busting parameter to force reload after signatures are embedded
  const cacheBuster = file.modifiedDate
    ? `&v=${encodeURIComponent(file.modifiedDate)}`
    : `&t=${Date.now()}`;
  const filePath = `/${basePath}/api/files/preview.php?id=${fileId}${cacheBuster}`;

  console.log("Using preview API:", filePath);

  // If no file ID, show placeholder
  if (!fileId) {
    console.warn("No valid file ID found. File:", file);
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%;">
        <span class="material-symbols-rounded" style="font-size: 80px; color: #0461CE;">description</span>
        <p style="color: #666; font-size: 14px;">No file uploaded or preview not available</p>
        <p style="color: #999; font-size: 12px;">File Type: ${fileType || "unknown"}</p>
      </div>
    `;
  }

  // PDF files - show all pages using iframe (like E-signature)
  if (fileType === "pdf") {
    return `<iframe src="${filePath}#view=FitH" type="application/pdf" width="100%" height="100%" style="border: none; background: #e8e8e8;"></iframe>`;
  }

  // Image files
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(fileType)) {
    return `<img src="${filePath}" alt="Document Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
  }

  // Office documents (DOCX, XLSX, PPTX)
  if (["docx", "doc", "xlsx", "xls", "pptx", "ppt"].includes(fileType)) {
    const containerId = "doc-preview-" + Date.now();

    // Return container and load document asynchronously
    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (fileType === "docx") {
        // Render DOCX using Mammoth
        container.innerHTML =
          '<p style="color: #666; text-align: center; padding: 40px;">Loading document...</p>';
        console.log("Fetching DOCX from:", filePath);

        if (typeof mammoth === "undefined") {
          console.error("Mammoth.js not loaded");
          container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%;">
              <span class="material-symbols-rounded" style="font-size: 80px; color: #0461CE;">description</span>
              <p style="color: #666; font-size: 14px;">${fileName}</p>
              <p style="color: #999; font-size: 12px;">DOCX preview library not loaded</p>
              <a href="${filePath}" download="${fileName}" style="padding: 12px 24px; background: #0461CE; color: white; text-decoration: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
                <span class="material-symbols-rounded">download</span>
                Download File
              </a>
            </div>
          `;
          return;
        }

        fetch(filePath, {
          credentials: "same-origin",
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        })
          .then((res) => {
            console.log(
              "Fetch response:",
              res.status,
              res.ok,
              res.headers.get("content-type"),
            );
            if (!res.ok) throw new Error("Failed to fetch: " + res.status);
            return res.arrayBuffer();
          })
          .then((arrayBuffer) => {
            console.log("ArrayBuffer size:", arrayBuffer.byteLength);
            if (arrayBuffer.byteLength === 0) {
              throw new Error("Empty file received");
            }
            return mammoth.convertToHtml({ arrayBuffer });
          })
          .then((result) => {
            console.log("Mammoth conversion success");
            container.innerHTML = `
              <div style="padding: 40px 60px; background: white; max-width: 850px; margin: 20px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 4px; min-height: 600px; line-height: 1.6; font-family: 'Times New Roman', serif; font-size: 14px;">
                ${result.value}
              </div>
            `;
            // Apply document-like styling
            const docContent = container.querySelector("div");
            if (docContent) {
              docContent
                .querySelectorAll("p")
                .forEach((p) => (p.style.marginBottom = "12px"));
              docContent.querySelectorAll("h1").forEach((h) => {
                h.style.fontSize = "24px";
                h.style.marginTop = "20px";
                h.style.marginBottom = "12px";
              });
              docContent.querySelectorAll("h2").forEach((h) => {
                h.style.fontSize = "20px";
                h.style.marginTop = "16px";
                h.style.marginBottom = "10px";
              });
              docContent.querySelectorAll("h3").forEach((h) => {
                h.style.fontSize = "16px";
                h.style.marginTop = "14px";
                h.style.marginBottom = "8px";
              });
            }
          })
          .catch((err) => {
            console.error("DOCX render error:", err, "Path:", filePath);
            container.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 40px;">
                <span class="material-symbols-rounded" style="font-size: 60px; color: #f44336;">error</span>
                <p style="color: #666; font-size: 14px; text-align: center;">Failed to load document preview</p>
                <p style="color: #999; font-size: 12px;">${err.message}</p>
                <a href="${filePath}" download="${fileName}" style="padding: 12px 24px; background: #0461CE; color: white; text-decoration: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
                  <span class="material-symbols-rounded">download</span>
                  Download & Open
                </a>
              </div>
            `;
          });
      } else if (["xlsx", "xls"].includes(fileType)) {
        // Render Excel using SheetJS
        container.innerHTML =
          '<p style="color: #666; text-align: center; padding: 40px;">Loading spreadsheet...</p>';

        if (typeof XLSX === "undefined") {
          console.error("SheetJS not loaded");
          container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%;">
              <span class="material-symbols-rounded" style="font-size: 80px; color: #0461CE;">table_chart</span>
              <p style="color: #666; font-size: 14px;">${fileName}</p>
              <p style="color: #999; font-size: 12px;">Excel preview library not loaded</p>
              <a href="${filePath}" download="${fileName}" style="padding: 12px 24px; background: #0461CE; color: white; text-decoration: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
                <span class="material-symbols-rounded">download</span>
                Download File
              </a>
            </div>
          `;
          return;
        }

        fetch(filePath, {
          credentials: "same-origin",
        })
          .then((res) => {
            console.log("Excel fetch response:", res.status, res.ok);
            if (!res.ok) throw new Error("Failed to fetch: " + res.status);
            return res.arrayBuffer();
          })
          .then((arrayBuffer) => {
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const html = XLSX.utils.sheet_to_html(firstSheet);
            container.innerHTML = `
              <div style="padding: 30px; background: white; overflow: auto;">
                <div style="overflow-x: auto;">${html}</div>
              </div>
            `;
            // Style the table
            const table = container.querySelector("table");
            if (table) {
              table.style.borderCollapse = "collapse";
              table.style.width = "100%";
              table.style.fontSize = "13px";
              table.querySelectorAll("td, th").forEach((cell) => {
                cell.style.border = "1px solid #ddd";
                cell.style.padding = "8px 12px";
                cell.style.textAlign = "left";
              });
              table.querySelectorAll("th").forEach((th) => {
                th.style.background = "#f5f5f5";
                th.style.fontWeight = "bold";
              });
            }
          })
          .catch((err) => {
            console.error("SheetJS error:", err);
            container.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 40px;">
                <span class="material-symbols-rounded" style="font-size: 60px; color: #f44336;">error</span>
                <p style="color: #666; font-size: 14px; text-align: center;">Failed to load spreadsheet preview</p>
                <p style="color: #999; font-size: 12px;">${err.message}</p>
                <a href="${filePath}" download="${fileName}" style="padding: 12px 24px; background: #0461CE; color: white; text-decoration: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
                  <span class="material-symbols-rounded">download</span>
                  Download & Open
                </a>
              </div>
            `;
          });
      } else {
        // Fallback for other Office formats
        const iconMap = {
          docx: "../assets/docs_blue.svg",
          doc: "../assets/docs_blue.svg",
          xlsx: "../assets/xlsx_green.svg",
          xls: "../assets/xlsx_green.svg",
          pptx: "../assets/docs_blue.svg",
          ppt: "../assets/docs_blue.svg",
        };
        const iconSrc = iconMap[fileType] || "../assets/docs_blue.svg";
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%;">
            <img src="${iconSrc}" alt="File Icon" style="width: 80px; height: 80px;">
            <p style="color: #666; font-size: 14px;">${fileName}</p>
            <a href="${filePath}" download style="padding: 12px 24px; background: #0461CE; color: white; text-decoration: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
              <span class="material-symbols-rounded">download</span>
              Download & Open
            </a>
          </div>
        `;
      }
    }, 100);

    return `<div id="${containerId}" style="width: 100%; height: 100%; overflow: auto;"><p style="color: #666; text-align: center; padding: 40px;">Loading...</p></div>`;
  }

  // Other file types
  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%;">
      <span class="material-symbols-rounded" style="font-size: 80px; color: #0461CE;">description</span>
      <h3 style="color: #333; margin: 0;">${fileName}</h3>
      <a href="${filePath}" download="${fileName}" style="padding: 12px 24px; background: #0461CE; color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px;">
        <span class="material-symbols-rounded">download</span>
        Download File
      </a>
    </div>
  `;
}

// Open file preview modal for repository files
function openRepoFilePreview(file) {
  console.log("Opening preview for file:", file);

  const previewModal = document.getElementById("repoPreviewModal");
  const previewTitle = document.getElementById("repoPreviewTitle");
  const previewContent = document.getElementById("repoPreviewContent");

  if (!previewModal || !previewTitle || !previewContent) {
    console.error("Preview modal elements not found");
    return;
  }

  const fileName = file.fileName || file.name || "Untitled";
  previewTitle.textContent = fileName;
  previewContent.innerHTML =
    '<p style="text-align: center; color: #666; padding: 40px;">Loading preview...</p>';
  previewModal.classList.add("active");

  console.log("Preview modal opened, loading content...");

  setTimeout(() => {
    previewContent.innerHTML = generateRepoFilePreview(file);
    console.log("Preview content loaded");
  }, 100);
}

// Close file preview modal
function closeRepoFilePreview() {
  const previewModal = document.getElementById("repoPreviewModal");
  if (previewModal) {
    previewModal.classList.remove("active");
    setTimeout(() => {
      document.getElementById("repoPreviewContent").innerHTML = "";
    }, 300);
  }
}

// Load initial data
async function init() {
  await fetchFolders();
  await fetchAllRepositoryFiles();
  await fetchRecentFiles();
  await fetchDepartments();

  // Setup preview modal close handler
  const closePreviewBtn = document.getElementById("closeRepoPreview");
  if (closePreviewBtn) {
    closePreviewBtn.addEventListener("click", closeRepoFilePreview);
  }

  const previewModal = document.getElementById("repoPreviewModal");
  if (previewModal) {
    previewModal.addEventListener("click", (e) => {
      if (e.target === previewModal) closeRepoFilePreview();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && previewModal?.classList.contains("active")) {
      closeRepoFilePreview();
    }
  });
}

// Start the app
init();
