const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");

// Only the collapse/expand functionality remains (works on all screens)
sidebarToggler.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});

// ========================= DATE & TIME DISPLAY =========================
function updateDateTime() {
  const now = new Date();

  // Format: September 12, Thursday | 13:30
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

// Update every second
updateDateTime();
setInterval(updateDateTime, 1000);

// Check document preview libraries
console.log("Document preview libraries loaded:", {
  pdfjsLib: typeof pdfjsLib !== "undefined",
  mammoth: typeof mammoth !== "undefined",
  XLSX: typeof XLSX !== "undefined",
});

// ========================= STATE MANAGEMENT =========================
let folders = [];
let allFiles = [];
let selectedFolderId = null;
let selectedFileId = null;

// ========================= BACKEND INTEGRATION =========================

// Fetch folders with permissions
async function fetchFoldersWithPermissions() {
  try {
    const response = await fetch("../api/folders/employee_access.php");
    const data = await response.json();

    if (data.success) {
      folders = data.folders;

      // Clear any selection state from API data
      folders.forEach((folder) => {
        folder.selected = false; // Use 'selected' for UI state, not 'active'
      });

      renderFolders();

      // Show initial placeholder in files section
      renderFiles();
    } else {
      console.error("Failed to fetch folders:", data.error);
      showNoAccessMessage();
    }
  } catch (error) {
    console.error("Error fetching folders:", error);
    showNoAccessMessage();
  }
}

// Fetch files for a specific folder
async function fetchFolderFiles(folderId) {
  try {
    console.log("Fetching files for folder ID:", folderId);

    const response = await fetch("../api/folders/employee_access.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "get_folder_files",
        folderId: parseInt(folderId),
      }),
    });

    const data = await response.json();
    console.log("Files API response:", data);

    if (data.success) {
      allFiles = data.files || [];
      console.log("Files loaded:", allFiles.length);

      if (allFiles.length > 0) {
        console.log("Sample file data:", allFiles[0]);
      }

      renderFiles();
    } else {
      console.error("API returned error:", data.error);
      allFiles = [];
      renderFiles();
      showToast(data.error || "Failed to load files", "error");
    }
  } catch (error) {
    console.error("Error fetching files:", error);
    allFiles = [];
    renderFiles();
    showToast("Failed to connect to server", "error");
  }
}

// ========================= RENDER FOLDERS =========================
function renderFolders() {
  const folderList = document.getElementById("folderList");

  if (folders.length === 0) {
    folderList.innerHTML = `
      <div class="placeholder-text">
        <span class="material-symbols-rounded placeholder-icon">folder_off</span>
        <p>No folders available</p>
      </div>
    `;
    return;
  }

  folderList.innerHTML = "";

  folders.forEach((folder) => {
    const folderItem = document.createElement("div");
    // Use 'selected' property for UI state, not 'active' from API
    folderItem.className = `folder-item ${folder.selected ? "active" : ""}`;
    folderItem.dataset.folderId = folder.id;

    folderItem.innerHTML = `
      <span class="material-symbols-rounded folder-icon">folder</span>
      <span class="folder-name">${folder.name}</span>
    `;

    // Use arrow function to maintain proper scope
    folderItem.addEventListener("click", (e) => {
      e.preventDefault();
      selectFolder(folder.id);
    });

    folderList.appendChild(folderItem);
  });
}

// ========================= SELECT FOLDER =========================
async function selectFolder(folderId) {
  console.log("Selecting folder:", folderId);

  // Convert to same type for comparison
  selectedFolderId = parseInt(folderId);

  // Update selected state in data (use 'selected' not 'active')
  folders.forEach((f) => (f.selected = parseInt(f.id) === selectedFolderId));

  // Update active class in DOM directly (more efficient than re-rendering)
  document.querySelectorAll(".folder-item").forEach((item) => {
    const itemFolderId = parseInt(item.dataset.folderId);
    if (itemFolderId === selectedFolderId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Reset files array and show loading state
  allFiles = [];
  const filesGrid = document.getElementById("filesGrid");
  filesGrid.innerHTML = `
    <div class="placeholder-text">
      <span class="material-symbols-rounded placeholder-icon">hourglass_empty</span>
      <p>Loading files...</p>
    </div>
  `;

  // Fetch and render files for selected folder
  await fetchFolderFiles(selectedFolderId);

  const selectedFolder = folders.find(
    (f) => parseInt(f.id) === selectedFolderId,
  );
  if (selectedFolder) {
    console.log(`Selected folder: ${selectedFolder.name}`);
  }
}

// ========================= RENDER FILES =========================
function renderFiles() {
  const filesGrid = document.getElementById("filesGrid");

  // No folder selected
  if (!selectedFolderId) {
    filesGrid.innerHTML = `
      <div class="placeholder-text">
        <span class="material-symbols-rounded placeholder-icon">folder_open</span>
        <p>Please select a folder to view files</p>
      </div>
    `;
    return;
  }

  // Folder selected but no files
  if (allFiles.length === 0) {
    filesGrid.innerHTML = `
      <div class="placeholder-text">
        <span class="material-symbols-rounded placeholder-icon">inbox</span>
        <p>This folder is empty</p>
      </div>
    `;
    return;
  }

  filesGrid.innerHTML = "";

  allFiles.forEach((file) => {
    const card = document.createElement("div");
    card.className = "file-card";
    card.dataset.fileId = file.id;

    // Get file name - API returns 'name'
    const fileName = file.name || "Untitled";

    // Determine file type for icon styling - API returns 'type'
    const fileExtension = file.type || getFileExtension(fileName);

    card.innerHTML = `
      <div class="file-card-icon ${fileExtension}">
        <span class="material-symbols-rounded">description</span>
      </div>
      <p class="file-card-name">${fileName}</p>
      <button class="btn-download-grid" data-file-id="${file.id}" title="Download ${fileName}">
        <span class="material-symbols-rounded">download</span>
      </button>
    `;

    // Download button click
    const downloadBtn = card.querySelector(".btn-download-grid");
    downloadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      downloadFile(file);
    });

    // Card click - show file details
    card.addEventListener("click", () => {
      showFileDetails(file);
    });

    filesGrid.appendChild(card);
  });
}

// ========================= HELPER FUNCTIONS =========================

// Get file extension from filename
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

// Show no access message
function showNoAccessMessage() {
  const folderList = document.getElementById("folderList");
  folderList.innerHTML = `
    <div class="placeholder-text">
      <span class="material-symbols-rounded placeholder-icon">folder_off</span>
      <p>You don't have access to any folders yet.</p>
      <p style="font-size: 12px; color: #999; margin-top: 8px;">Please contact your administrator.</p>
    </div>
  `;

  const filesGrid = document.getElementById("filesGrid");
  filesGrid.innerHTML = `
    <div class="placeholder-text">
      <span class="material-symbols-rounded placeholder-icon">inbox</span>
      <p>No files available</p>
    </div>
  `;
}

// ========================= DOWNLOAD FILE =========================
function downloadFile(file) {
  const fileName = file.name || "Untitled";
  const fileId = file.id;

  console.log(`Downloading file: ${fileName}`, file);

  if (!fileId) {
    console.error("File ID not found:", file);
    showToast("Cannot download file: ID not found", "error");
    return;
  }

  // Get the base path dynamically (e.g., /FlowDocs/)
  const pathArray = window.location.pathname.split("/");
  const basePath = "/" + pathArray[1]; // Gets /FlowDocs
  const downloadUrl = `${basePath}/api/files/download.php?id=${fileId}`;

  console.log("Download URL:", downloadUrl);

  // Show download progress toast
  showDownloadProgress(fileName, 0);

  // Use XMLHttpRequest for progress tracking
  const xhr = new XMLHttpRequest();

  xhr.open("GET", downloadUrl, true);
  xhr.responseType = "blob";

  // Track download progress
  xhr.onprogress = function (event) {
    if (event.lengthComputable) {
      const percentComplete = Math.round((event.loaded / event.total) * 100);
      updateDownloadProgress(percentComplete);
    }
  };

  // Handle successful download
  xhr.onload = function () {
    if (xhr.status === 200) {
      // Get the blob
      const blob = xhr.response;

      // Get filename from Content-Disposition header if available
      const contentDisposition = xhr.getResponseHeader("Content-Disposition");
      let downloadFileName = fileName;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          downloadFileName = filenameMatch[1];
        }
      }

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = downloadFileName;

      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success message
      showDownloadSuccess(downloadFileName);

      console.log(`File downloaded successfully: ${downloadFileName}`);
    } else {
      // Handle error responses
      handleDownloadError(xhr);
    }
  };

  // Handle network errors
  xhr.onerror = function () {
    hideDownloadToast();
    showToast("Network error: Failed to download file", "error");
    console.error("Download network error");
  };

  // Handle timeout
  xhr.ontimeout = function () {
    hideDownloadToast();
    showToast("Download timeout: Please try again", "error");
    console.error("Download timeout");
  };

  // Set timeout to 2 minutes for large files
  xhr.timeout = 120000;

  // Send the request
  xhr.send();
}

// Handle download errors
function handleDownloadError(xhr) {
  hideDownloadToast();

  const contentType = xhr.getResponseHeader("Content-Type");

  // Check if response is JSON (error message)
  if (contentType && contentType.includes("application/json")) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const errorData = JSON.parse(reader.result);
        showToast(errorData.error || "Failed to download file", "error");
      } catch (e) {
        showToast("Failed to download file", "error");
      }
    };
    reader.readAsText(xhr.response);
  } else {
    // For non-JSON responses, show generic error based on status
    let errorMessage = "Failed to download file";

    if (xhr.status === 401) {
      errorMessage = "Unauthorized: Please log in";
    } else if (xhr.status === 403) {
      errorMessage = "Access denied: You don't have permission";
    } else if (xhr.status === 404) {
      errorMessage = "File not found";
    } else if (xhr.status === 500) {
      errorMessage = "Server error: Please try again later";
    }

    showToast(errorMessage, "error");
  }

  console.error("Download failed with status:", xhr.status);
}

// Show download progress toast
function showDownloadProgress(filename, percentage) {
  const toast = document.getElementById("downloadToast");
  const toastIcon = document.getElementById("downloadToastIcon");
  const toastFilename = document.getElementById("downloadToastFilename");
  const progressFill = document.getElementById("downloadProgressFill");
  const toastPercentage = document.getElementById("downloadToastPercentage");

  if (!toast) return;

  toastFilename.textContent = filename;
  toastIcon.textContent = "downloading";
  progressFill.style.width = percentage + "%";
  toastPercentage.textContent = percentage + "%";

  toast.className = "download-toast show";
}

// Update download progress
function updateDownloadProgress(percentage) {
  const progressFill = document.getElementById("downloadProgressFill");
  const toastPercentage = document.getElementById("downloadToastPercentage");

  if (progressFill && toastPercentage) {
    progressFill.style.width = percentage + "%";
    toastPercentage.textContent = percentage + "%";
  }
}

// Show download success
function showDownloadSuccess(filename) {
  const toast = document.getElementById("downloadToast");
  const toastIcon = document.getElementById("downloadToastIcon");
  const toastFilename = document.getElementById("downloadToastFilename");
  const progressFill = document.getElementById("downloadProgressFill");
  const toastPercentage = document.getElementById("downloadToastPercentage");

  if (!toast) return;

  toastFilename.textContent = filename + " downloaded";
  toastIcon.textContent = "check_circle";
  progressFill.style.width = "100%";
  toastPercentage.textContent = "Complete!";

  toast.className = "download-toast show success";

  // Hide after 3 seconds
  setTimeout(() => {
    hideDownloadToast();
  }, 3000);
}

// Hide download toast
function hideDownloadToast() {
  const toast = document.getElementById("downloadToast");
  if (toast) {
    toast.classList.remove("show", "success", "error");

    // Reset after animation
    setTimeout(() => {
      const progressFill = document.getElementById("downloadProgressFill");
      const toastPercentage = document.getElementById(
        "downloadToastPercentage",
      );
      if (progressFill) progressFill.style.width = "0%";
      if (toastPercentage) toastPercentage.textContent = "0%";
    }, 400);
  }
}

// ========================= SELECT FILE =========================
function selectFile(fileId) {
  selectedFileId = fileId;
  const file = allFiles.find((f) => f.id === fileId);

  // Update active state
  document.querySelectorAll(".file-card").forEach((card) => {
    card.classList.remove("active");
    if (parseInt(card.dataset.fileId) === fileId) {
      card.classList.add("active");
    }
  });

  console.log(`File selected: ${file.name}`);
}

// ========================= INITIAL LOAD =========================
document.addEventListener("DOMContentLoaded", () => {
  fetchFoldersWithPermissions();
  initializeModalHandlers();
  initializePreviewModalHandlers();
});

// ========================= MODAL FUNCTIONS =========================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    console.log("Modal opened:", modalId);
  } else {
    console.error("Modal not found:", modalId);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    console.log("Modal closed:", modalId);
  }
}

// Initialize modal close handlers
function initializeModalHandlers() {
  // Setup modal close buttons
  document.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-modal");
      if (modalId) {
        closeModal(modalId);
      }
    });
  });

  // Setup modal overlay close
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", () => {
      const modalId = overlay.getAttribute("data-modal");
      if (modalId) {
        closeModal(modalId);
      }
    });
  });

  console.log("Modal handlers initialized");
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

// ========================= FILE DETAILS MODAL =========================
function showFileDetails(file) {
  console.log("Showing file details for:", file);

  const container = document.getElementById("fileDetailsContainer");

  if (!container) {
    console.error("File details container not found!");
    return;
  }

  // Get file properties from API response
  const fileName = file.name || "Untitled";
  const fileType = file.type || getFileExtension(fileName);
  const iconClass = fileType || "pdf";
  const fileSize = file.size || "Unknown";
  const uploadedBy = file.uploadedByName || "Unknown";
  const uploadDate = file.uploadedAt || "Unknown";

  container.innerHTML = `
    <div style="display: flex; align-items: center; flex-direction: column;">
      <div class="file-icon-large ${iconClass}">
        <span class="material-symbols-rounded">description</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; color: #333; margin: 8px 0; text-align: center;">
        ${fileName}
      </h2>
    </div>

    <div class="detail-section">
      <h3>File Information</h3>
      <div class="detail-item">
        <span class="detail-label">File Type</span>
        <span class="detail-value">${iconClass.toUpperCase()}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">File Size</span>
        <span class="detail-value">${fileSize}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Uploaded By</span>
        <span class="detail-value">${uploadedBy}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Upload Date</span>
        <span class="detail-value">${formatDate(uploadDate)}</span>
      </div>
    </div>

    <div class="modal-actions" style="border-top: none; background: transparent; padding: 20px 0 0 0;">
      <button class="btn-primary btn-view-document">
        <span class="material-symbols-rounded">visibility</span>
        View Document
      </button>
      <button class="btn-secondary btn-download-detail">
        <span class="material-symbols-rounded">download</span>
        Download
      </button>
    </div>
  `;

  // View document button
  container
    .querySelector(".btn-view-document")
    .addEventListener("click", () => {
      closeModal("fileDetailsModal");
      openRepoFilePreview(file);
    });

  // Download button
  container
    .querySelector(".btn-download-detail")
    .addEventListener("click", () => {
      downloadFile(file);
    });

  openModal("fileDetailsModal");
}

// ========================= FILE PREVIEW FUNCTIONS =========================
function generateRepoFilePreview(file) {
  // Get file properties from API response
  const fileName = file.name || "Untitled";
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

  // PDF Preview - show all pages using iframe (like E-signature)
  if (fileType === "pdf") {
    return `<iframe src="${filePath}#view=FitH" type="application/pdf" width="100%" height="100%" style="border: none; background: #e8e8e8;"></iframe>`;
  }

  // Image files
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(fileType)) {
    return `<img src="${filePath}" alt="Document Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
  }

  // DOCX Preview
  if (fileType === "docx" || fileType === "doc") {
    const containerId = "docxPreviewContainer_" + Date.now();
    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (container) {
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

        container.innerHTML =
          '<p style="color: #666; text-align: center; padding: 40px;">Loading document...</p>';
        console.log("Fetching DOCX from:", filePath);

        fetch(filePath, {
          credentials: "same-origin",
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        })
          .then((response) => {
            console.log("Fetch response:", response.status, response.ok);
            if (!response.ok)
              throw new Error("Failed to fetch: " + response.status);
            return response.arrayBuffer();
          })
          .then((arrayBuffer) => mammoth.convertToHtml({ arrayBuffer }))
          .then((result) => {
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
            console.error("DOCX loading error:", err);
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
      }
    }, 100);

    return `<div id="${containerId}" style="width: 100%; height: 100%; overflow: auto;"><p style="color: #666; text-align: center; padding: 40px;">Loading document...</p></div>`;
  }

  // XLSX/XLS Preview
  if (fileType === "xlsx" || fileType === "xls") {
    const containerId = "xlsxPreviewContainer_" + Date.now();
    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (container && typeof XLSX !== "undefined") {
        container.innerHTML =
          '<p style="color: #666; text-align: center; padding: 40px;">Loading spreadsheet...</p>';
        fetch(filePath)
          .then((response) => response.arrayBuffer())
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
            console.error("XLSX loading error:", err);
            container.innerHTML =
              '<p style="color: #f44336; text-align: center; padding: 20px;">Failed to load spreadsheet. <a href="' +
              filePath +
              '" download style="color: #0461CE;">Download instead</a></p>';
          });
      } else {
        const iconMap = {
          pdf: "../assets/pdf_red.svg",
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

function openRepoFilePreview(file) {
  console.log("Opening preview for file:", file);

  const previewModal = document.getElementById("repoPreviewModal");
  const previewTitle = document.getElementById("repoPreviewTitle");
  const previewContent = document.getElementById("repoPreviewContent");

  if (!previewModal || !previewTitle || !previewContent) {
    console.error("Preview modal elements not found");
    return;
  }

  const fileName = file.name || "Untitled";
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

function closeRepoFilePreview() {
  const previewModal = document.getElementById("repoPreviewModal");
  if (previewModal) {
    previewModal.classList.remove("active");
    setTimeout(() => {
      document.getElementById("repoPreviewContent").innerHTML = "";
    }, 300);
  }
}

// Initialize preview modal handlers
function initializePreviewModalHandlers() {
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

  console.log("Preview modal handlers initialized");
}

// ========================= HELPER FUNCTIONS =========================
function formatDate(dateString) {
  if (!dateString || dateString === "Unknown") return "Unknown";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const options = { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
}
