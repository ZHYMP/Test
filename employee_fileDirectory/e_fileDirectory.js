const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");

// Sidebar collapse/expand functionality
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

// ========================= FILES DATA =========================
let allFiles = [];

// ========================= STATE MANAGEMENT =========================
let currentStatus = "approved";
let selectedFileId = null;
let selectedFile = null;

// ========================= FETCH FILES FROM BACKEND =========================
async function fetchFiles(status = currentStatus) {
  try {
    // Employee backend automatically filters to show only their files
    const response = await fetch(
      `../api/files/directory.php?status=${status}&department=all`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch files");
    }

    allFiles = data.files || [];

    // Update status counters
    if (data.counts) {
      document.getElementById("approvedCount").textContent =
        data.counts.approved || 0;
      document.getElementById("progressCount").textContent =
        data.counts["in-progress"] || 0;
      document.getElementById("revisionCount").textContent =
        data.counts.declined || 0;
    }

    return allFiles;
  } catch (error) {
    console.error("Error fetching files:", error);
    showToast("Failed to load files: " + error.message, "error");
    return [];
  }
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
  } else if (type === "info") {
    toastIcon.textContent = "info";
  }

  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// ========================= STATUS TAB SWITCHING =========================
const tabButtons = document.querySelectorAll(".tab-btn");
tabButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    // Remove active class from all tabs
    tabButtons.forEach((tab) => tab.classList.remove("active"));

    // Add active to clicked tab
    btn.classList.add("active");

    // Update current status
    currentStatus = btn.dataset.status;

    // Reset selection
    selectedFileId = null;
    selectedFile = null;
    document.getElementById("detailsCard").style.display = "none";
    document.getElementById("documentPreview").innerHTML =
      '<p class="no-selection">Select a file to preview</p>';

    // Fetch and render files from backend
    await fetchFiles(currentStatus);
    renderFiles();
  });
});

// ========================= RENDER FILES =========================
function renderFiles() {
  const filesList = document.getElementById("filesList");

  // Files are already filtered by backend API
  const filteredFiles = allFiles;

  if (filteredFiles.length === 0) {
    filesList.innerHTML =
      '<div class="file-card placeholder-card"><p>No files found</p></div>';
    return;
  }

  // Clear placeholder
  filesList.innerHTML = "";

  // Render each file
  filteredFiles.forEach((file) => {
    const fileCard = document.createElement("div");
    fileCard.className = "file-card";
    fileCard.dataset.fileId = file.id;
    fileCard.dataset.status = file.status;

    const signatureEmblem = file.requiresSignature
      ? `<img src="../assets/signatory.svg" alt="Requires Signature" class="signature-emblem" title="Requires Signature">`
      : "";

    fileCard.innerHTML = `
      <div class="file-icon ${file.type}">
        <span class="material-symbols-rounded">description</span>
      </div>
      <div class="file-details">
        <h5 class="file-card-name">
          ${file.name}
          ${signatureEmblem}
        </h5>
        <div class="file-card-meta">
          <span class="file-card-status ${file.status}">${formatStatus(file.status)}</span>
          <span class="file-card-date">${file.uploadDate}</span>
        </div>
      </div>
    `;

    // Add click handler
    fileCard.addEventListener("click", () => selectFile(file.id));

    filesList.appendChild(fileCard);
  });
}

// ========================= FORMAT STATUS =========================
function formatStatus(status) {
  const statusMap = {
    approved: "Approved",
    "in-progress": "In Progress",
    declined: "For Revisions",
  };
  return statusMap[status] || status;
}

// ========================= SELECT FILE =========================
function selectFile(fileId) {
  selectedFileId = fileId;
  const file = allFiles.find((f) => f.id === fileId);
  selectedFile = file;

  if (!file) return;

  // Update active state on cards
  document.querySelectorAll(".file-card").forEach((card) => {
    card.classList.remove("active");
    if (parseInt(card.dataset.fileId) === fileId) {
      card.classList.add("active");
    }
  });

  // Show document preview
  const preview = document.getElementById("documentPreview");

  // Generate signature progress if file requires signature
  let signatureProgress = "";
  if (file.requiresSignature && file.signatories) {
    const totalSignatories = file.signatories.length;
    const signedCount = file.signatories.filter((s) => s.signed).length;
    const progressPercentage = (signedCount / totalSignatories) * 100;

    const signatoriesHTML = file.signatories
      .map(
        (signatory) => `
      <div class="signatory-item ${signatory.signed ? "signed" : "pending"}">
        <div class="signatory-avatar">
          <span class="material-symbols-rounded">${signatory.signed ? "check_circle" : "person"}</span>
        </div>
        <div class="signatory-info">
          <div class="signatory-name">${signatory.name}</div>
          <div class="signatory-status">${signatory.signed ? `Signed: ${signatory.signedDate}` : "Pending"}</div>
        </div>
      </div>
    `,
      )
      .join("");

    signatureProgress = `
      <div class="signature-progress-section">
        <div class="signature-header">
          <h4 class="signature-title">
            <span class="material-symbols-rounded">draw</span>
            Signature Progress
          </h4>
          <div class="signature-count">${signedCount} of ${totalSignatories} signed</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercentage}%"></div>
        </div>
        <div class="signatories-list">
          ${signatoriesHTML}
        </div>
        ${
          file.status === "in-progress" &&
          !file.signatories.find((s) => s.name === file.owner && !s.signed)
            ? ""
            : `
        <a href="../employee_e-signature/e_e-signature.html" class="btn-esignature">
          E-signature
        </a>
        `
        }
      </div>
    `;
  }

  preview.innerHTML = `
    ${signatureProgress}
    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 20px;">
      <span class="material-symbols-rounded" style="font-size: 80px; color: #0461CE;">description</span>
      <p style="color: #666; font-size: 18px; font-weight: 500;">${file.name}</p>
      <button class="btn-view-document" data-file-id="${file.id}" style="padding: 12px 24px; background: #0461CE; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
        <span class="material-symbols-rounded">visibility</span>
        View Document
      </button>
    </div>
  `;

  // Show and populate details card
  const detailsCard = document.getElementById("detailsCard");
  detailsCard.style.display = "flex";

  document.getElementById("fileNameDisplay").textContent = file.name;
  document.getElementById("ownerNameDisplay").textContent = "My Document";

  const statusPill = document.getElementById("statusPill");
  statusPill.textContent = formatStatus(file.status);
  statusPill.className = "status-pill " + file.status;

  document.getElementById("uploadDateDisplay").textContent = file.uploadDate;
  document.getElementById("modifiedDateDisplay").textContent =
    file.modifiedDate;

  // Show/hide resubmit button based on status (only for declined and in-progress)
  const resubmitBtn = document.getElementById("resubmitBtn");
  if (file.status === "declined" || file.status === "in-progress") {
    resubmitBtn.style.display = "block";
  } else {
    resubmitBtn.style.display = "none";
  }

  // Render comment history
  renderCommentHistory(file.comments || []);

  console.log("Selected file:", file);
}

// ========================= RENDER COMMENT HISTORY =========================
function renderCommentHistory(comments) {
  const historyList = document.getElementById("commentHistoryList");

  if (!comments || comments.length === 0) {
    historyList.innerHTML = '<p class="no-history">No comments yet</p>';
    return;
  }

  historyList.innerHTML = comments
    .map((comment) => {
      let actionBadge = "";
      if (comment.action === "approved") {
        actionBadge = '<span class="action-badge approved">Approved</span>';
      } else if (comment.action === "declined") {
        actionBadge = '<span class="action-badge declined">Declined</span>';
      } else if (comment.action === "returned") {
        actionBadge = '<span class="action-badge returned">Returned</span>';
      }

      return `
      <div class="history-item">
        <div class="history-header">
          <div class="history-user">
            <span class="material-symbols-rounded">account_circle</span>
            <span class="user-name">${comment.user}</span>
            ${actionBadge}
          </div>
          <span class="history-timestamp">${comment.timestamp}</span>
        </div>
        <p class="history-message">${comment.message}</p>
      </div>
    `;
    })
    .join("");
}

// ========================= RE-SUBMIT MODAL & FUNCTIONALITY =========================
const resubmitBtn = document.getElementById("resubmitBtn");
const resubmitModal = document.getElementById("resubmitModal");
const modalClose = document.getElementById("modalClose");
const cancelResubmit = document.getElementById("cancelResubmit");
const fileUploadArea = document.getElementById("fileUploadArea");
const fileInput = document.getElementById("fileInput");
const selectedFileInfo = document.getElementById("selectedFileInfo");
const selectedFileName = document.getElementById("selectedFileName");
const removeFile = document.getElementById("removeFile");
const confirmResubmit = document.getElementById("confirmResubmit");

let selectedResubmitFile = null;

// Open modal
resubmitBtn.addEventListener("click", () => {
  if (!selectedFile) {
    showToast("Please select a file first", "error");
    return;
  }

  resubmitModal.classList.add("active");
  selectedResubmitFile = null;
  fileInput.value = "";
  selectedFileInfo.style.display = "none";
  fileUploadArea.style.display = "flex";
  confirmResubmit.disabled = true;
});

// Close modal
function closeModal() {
  resubmitModal.classList.remove("active");
  selectedResubmitFile = null;
  fileInput.value = "";
}

modalClose.addEventListener("click", closeModal);
cancelResubmit.addEventListener("click", closeModal);

// File upload area click
fileUploadArea.addEventListener("click", () => {
  fileInput.click();
});

// Drag and drop
fileUploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileUploadArea.classList.add("drag-over");
});

fileUploadArea.addEventListener("dragleave", () => {
  fileUploadArea.classList.remove("drag-over");
});

fileUploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  fileUploadArea.classList.remove("drag-over");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFileSelect(files[0]);
  }
});

// File selected
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFileSelect(e.target.files[0]);
  }
});

// Handle file selection
function handleFileSelect(file) {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    showToast(
      "Invalid file type. Please select PDF, DOC, DOCX, XLS, or XLSX",
      "error",
    );
    return;
  }

  if (file.size > maxSize) {
    showToast("File size exceeds 10MB limit", "error");
    return;
  }

  selectedResubmitFile = file;
  selectedFileName.textContent = file.name;
  fileUploadArea.style.display = "none";
  selectedFileInfo.style.display = "flex";
  confirmResubmit.disabled = false;
}

// Remove selected file
removeFile.addEventListener("click", (e) => {
  e.stopPropagation();
  selectedResubmitFile = null;
  fileInput.value = "";
  selectedFileInfo.style.display = "none";
  fileUploadArea.style.display = "flex";
  confirmResubmit.disabled = true;
});

// Confirm resubmit
confirmResubmit.addEventListener("click", async () => {
  if (!selectedResubmitFile || !selectedFile) {
    showToast("Please select a file to upload", "error");
    return;
  }

  confirmResubmit.disabled = true;
  confirmResubmit.textContent = "Uploading...";

  try {
    const formData = new FormData();
    formData.append("file", selectedResubmitFile);
    formData.append("documentId", selectedFile.id);

    const response = await fetch("../api/documents/resubmit.php", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to resubmit document");
    }

    showToast("Document resubmitted successfully!", "success");
    closeModal();

    // Refresh files list
    await fetchFiles(currentStatus);
    renderFiles();

    // If current file is still selected, update it
    if (selectedFileId) {
      const updatedFile = allFiles.find((f) => f.id === selectedFileId);
      if (updatedFile) {
        selectFile(selectedFileId);
      } else {
        // File moved to different status
        selectedFileId = null;
        selectedFile = null;
        document.getElementById("detailsCard").style.display = "none";
        document.getElementById("documentPreview").innerHTML =
          '<p class="no-selection">Select a file to preview</p>';
      }
    }
  } catch (error) {
    console.error("Error resubmitting document:", error);
    showToast("Failed to resubmit: " + error.message, "error");
  } finally {
    confirmResubmit.disabled = false;
    confirmResubmit.textContent = "Re-submit";
  }
});

// ========================= INITIAL RENDER =========================
// Load files from backend on page load
(async function initializeFileDirectory() {
  try {
    await fetchFiles(currentStatus);
    renderFiles();
  } catch (error) {
    console.error("Error initializing file directory:", error);
    const filesList = document.getElementById("filesList");
    filesList.innerHTML =
      '<div class="file-card placeholder-card"><p>Failed to load files. Please refresh the page.</p></div>';
  }
})();

// ========================= FILE PREVIEW MODAL =========================

// Generate file preview for directory files
function generateDirFilePreview(file) {
  const fileName = file.name || file.fileName || "Untitled";
  const fileType = file.type ? file.type.toLowerCase() : "";
  const fileId = file.id;

  // If file has an ID, use preview API endpoint (more reliable)
  let filePath;
  if (fileId) {
    const basePath = window.location.pathname.split("/")[1];
    // Add cache-busting parameter to force reload after signatures are embedded
    const cacheBuster = file.modifiedDate
      ? `&v=${encodeURIComponent(file.modifiedDate)}`
      : `&t=${Date.now()}`;
    filePath = `/${basePath}/api/files/preview.php?id=${fileId}${cacheBuster}`;
  } else {
    // Fallback to direct file path if no ID
    filePath = file.filePath || file.file_path || file.preview;

    // Normalize file path
    if (filePath && filePath.startsWith("../../uploads/")) {
      filePath = filePath.replace("../../uploads/", "../uploads/");
    }

    // URL encode the filename part
    if (filePath && filePath.includes("/")) {
      const parts = filePath.split("/");
      const filename = parts.pop();
      filePath = parts.join("/") + "/" + encodeURIComponent(filename);
    }
  }

  console.log("Generating directory preview:", {
    fileName,
    fileId,
    fileType,
    resolvedPath: filePath,
    fullFileObject: file,
  });

  // If no file path, show placeholder
  if (!filePath || filePath.includes(".svg")) {
    console.warn("No valid file path found. FilePath:", filePath);
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
          .then((res) => {
            console.log("Fetch response:", res.status, res.ok);
            if (!res.ok) throw new Error("Failed to fetch: " + res.status);
            return res.arrayBuffer();
          })
          .then((arrayBuffer) => {
            console.log("ArrayBuffer size:", arrayBuffer.byteLength);
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

        container.innerHTML =
          '<p style="color: #666; text-align: center; padding: 40px;">Loading spreadsheet...</p>';
        fetch(filePath, {
          credentials: "same-origin",
        })
          .then((res) => res.arrayBuffer())
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

// Open file preview modal for directory files
async function openDirFilePreview(file) {
  console.log("Opening preview for file:", file);

  const previewModal = document.getElementById("dirPreviewModal");
  const previewTitle = document.getElementById("dirPreviewTitle");
  const previewContent = document.getElementById("dirPreviewContent");

  if (!previewModal || !previewTitle || !previewContent) {
    console.error("Preview modal elements not found");
    return;
  }

  const fileName = file.name || file.fileName || "Untitled";
  previewTitle.textContent = fileName;
  previewContent.innerHTML =
    '<p style="text-align: center; color: #666; padding: 40px;">Loading preview...</p>';
  previewModal.classList.add("active");

  console.log("Preview modal opened, loading content...");

  setTimeout(async () => {
    const basePreview = generateDirFilePreview(file);

    // Create container for preview with signatures
    const previewContainer = document.createElement("div");
    previewContainer.style.position = "relative";
    previewContainer.style.width = "100%";
    previewContainer.style.height = "100%";
    previewContainer.innerHTML = basePreview;

    // Fetch and overlay signatures if file has an ID
    if (file.id) {
      try {
        const response = await fetch(
          `../api/signatures/get_document_signatures.php?fileId=${file.id}`,
        );
        const data = await response.json();

        if (data.success && data.signatures && data.signatures.length > 0) {
          // Show signature count badge only (floating signatures removed)
          const badge = document.createElement("div");
          badge.style.position = "absolute";
          badge.style.top = "10px";
          badge.style.right = "10px";
          badge.style.background = "#0461CE";
          badge.style.color = "white";
          badge.style.padding = "8px 16px";
          badge.style.borderRadius = "20px";
          badge.style.fontSize = "14px";
          badge.style.fontWeight = "600";
          badge.style.zIndex = "20";
          badge.style.boxShadow = "0 2px 8px rgba(4, 97, 206, 0.3)";
          badge.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">draw</span>${data.signatures.length} Signature${data.signatures.length > 1 ? "s" : ""}`;
          previewContainer.appendChild(badge);
        }
      } catch (error) {
        console.error("Error fetching signatures:", error);
      }
    }

    previewContent.innerHTML = "";
    previewContent.appendChild(previewContainer);
    console.log("Preview content loaded");
  }, 100);
}

// Close file preview modal
function closeDirFilePreview() {
  const previewModal = document.getElementById("dirPreviewModal");
  if (previewModal) {
    previewModal.classList.remove("active");
    setTimeout(() => {
      document.getElementById("dirPreviewContent").innerHTML = "";
    }, 300);
  }
}

// Setup preview modal event listeners
const closePreviewBtn = document.getElementById("closeDirPreview");
if (closePreviewBtn) {
  closePreviewBtn.addEventListener("click", closeDirFilePreview);
}

const dirPreviewModal = document.getElementById("dirPreviewModal");
if (dirPreviewModal) {
  dirPreviewModal.addEventListener("click", (e) => {
    if (e.target === dirPreviewModal) closeDirFilePreview();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dirPreviewModal?.classList.contains("active")) {
    closeDirFilePreview();
  }
});

// Event delegation for View Document button
document.addEventListener("click", (e) => {
  if (e.target.closest(".btn-view-document")) {
    const btn = e.target.closest(".btn-view-document");
    const fileId = parseInt(btn.getAttribute("data-file-id"));
    if (fileId) {
      const file = allFiles.find((f) => f.id === fileId);
      if (file) {
        openDirFilePreview(file);
      }
    }
  }
});
