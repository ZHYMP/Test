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

  const formattedDateTime = `${dateString} | ${timeString}`;

  document.getElementById("datetimeDisplay").textContent = formattedDateTime;
}

updateDateTime();
setInterval(updateDateTime, 1000);

// ========================= SELECTED DOCUMENT STATE =========================
let selectedDocument = null;
let currentDepartmentFilter = "all";

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
  }

  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// ========================= DEPARTMENT FILTER TABS =========================
const tabButtons = document.querySelectorAll(".tab-btn");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", function () {
    // Remove active class from all tabs
    tabButtons.forEach((tab) => tab.classList.remove("active"));

    // Add active class to clicked tab
    this.classList.add("active");

    // Get selected department
    currentDepartmentFilter = this.getAttribute("data-department");

    console.log("Department filter changed to:", currentDepartmentFilter);

    // Re-render pending documents with filter
    renderPendingDocuments(currentDepartmentFilter);
  });
});

// ========================= RENDER PENDING DOCUMENTS =========================
function renderPendingDocuments(department = "all") {
  const tableBody = document.getElementById("pendingDocsTableBody");

  // Filter documents by department (show all documents for admin)
  const filteredDocs =
    department === "all"
      ? pendingDocuments
      : pendingDocuments.filter(
          (doc) =>
            doc.department &&
            doc.department.toLowerCase() === department.toLowerCase(),
        );

  if (filteredDocs.length === 0) {
    tableBody.innerHTML = `
      <div class="table-row placeholder-row">
        <div class="col-full">No pending documents found for this department.</div>
      </div>
    `;
    return;
  }

  tableBody.innerHTML = "";

  filteredDocs.forEach((doc, index) => {
    const row = document.createElement("div");
    row.className = "table-row";
    if (index === 0) row.classList.add("selected");
    row.setAttribute("data-doc-id", doc.id);
    row.setAttribute("data-department", doc.department);

    const statusClass = doc.status.toLowerCase().replace(" ", "-");
    const signatureEmblem = doc.requiresSignature
      ? `<img src="../assets/signatory.svg" alt="Requires Signature" class="signature-emblem" title="Requires Signature">`
      : "";

    row.innerHTML = `
      <div class="col-filename">
        ${doc.fileName}
        ${signatureEmblem}
      </div>
      <div class="col-status">
        <span class="status-badge status-${statusClass}">${doc.status}</span>
      </div>
      <div class="col-duedate">${doc.dueDate}</div>
      <div class="col-staff">${doc.staff}</div>
    `;

    row.addEventListener("click", () => selectDocument(doc, row));

    tableBody.appendChild(row);
  });

  // Auto-select first document
  if (filteredDocs.length > 0) {
    selectDocument(filteredDocs[0]);
  }
}

// ========================= SELECT DOCUMENT =========================
function selectDocument(doc, clickedRow = null) {
  selectedDocument = doc;

  // Update selected state
  document.querySelectorAll(".table-row").forEach((row) => {
    row.classList.remove("selected");
  });

  if (clickedRow) {
    clickedRow.classList.add("selected");
  } else {
    // Find and select first row
    const firstRow = document.querySelector(
      '.table-row[data-doc-id="' + doc.id + '"]',
    );
    if (firstRow) firstRow.classList.add("selected");
  }

  // Render preview
  renderPreview(doc);
}

// ========================= FILE PREVIEW GENERATOR =========================
function generateFilePreview(doc) {
  const fileType = doc.type ? doc.type.toLowerCase() : "";
  const fileId = doc.id;

  // If file has an ID, use preview API endpoint (more reliable)
  let filePath;
  if (fileId) {
    const basePath = window.location.pathname.split("/")[1];
    // Add cache-busting parameter to force reload after signatures are embedded
    const cacheBuster = doc.modifiedDate
      ? `&v=${encodeURIComponent(doc.modifiedDate)}`
      : `&t=${Date.now()}`;
    filePath = `/${basePath}/api/files/preview.php?id=${fileId}${cacheBuster}`;
  } else {
    // Fallback to direct file path if no ID
    filePath = doc.filePath || doc.preview;

    // Normalize file path - if it starts with ../../uploads/, convert to ../uploads/
    if (filePath && filePath.startsWith("../../uploads/")) {
      filePath = filePath.replace("../../uploads/", "../uploads/");
    }

    // URL encode the filename part (after the last slash) to handle spaces
    if (filePath && filePath.includes("/")) {
      const parts = filePath.split("/");
      const filename = parts.pop();
      filePath = parts.join("/") + "/" + encodeURIComponent(filename);
    }
  }

  console.log("Preview doc:", {
    fileName: doc.fileName,
    fileId,
    originalPath: doc.filePath,
    resolvedPath: filePath,
    fileType,
    doc,
  });

  // If no file path, show placeholder
  if (!filePath || filePath.includes(".svg")) {
    const iconSrc = doc.preview || "../assets/docs_blue.svg";
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%;">
        <img src="${iconSrc}" alt="File Icon" style="width: 80px; height: 80px;">
        <p style="color: #666; font-size: 14px;">No file uploaded yet or preview not available</p>
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
    const isLocalhost = ["localhost", "127.0.0.1"].includes(
      window.location.hostname,
    );
    const absoluteUrl = filePath
      ? new URL(filePath, window.location.href).toString()
      : "";

    // Prefer Office Online viewer when file is publicly accessible
    if (!isLocalhost && absoluteUrl) {
      const officeViewerUrl =
        "https://view.officeapps.live.com/op/embed.aspx?src=" +
        encodeURIComponent(absoluteUrl);
      return `<iframe src="${officeViewerUrl}" width="100%" height="100%" style="border: none; background: white;" allowfullscreen></iframe>`;
    }

    // Create container for rendered content
    const containerId = "doc-preview-" + Date.now();

    // Return container and load document asynchronously
    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (fileType === "docx" && typeof mammoth !== "undefined") {
        // Render DOCX using Mammoth
        container.innerHTML = '<p style="color: #666;">Loading document...</p>';
        console.log("Fetching DOCX from:", filePath);
        fetch(filePath)
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
            container.innerHTML =
              '<p style="color: #f44336;">Failed to load document (' +
              err.message +
              '). <a href="' +
              filePath +
              '" download style="color: #0461CE;">Download instead</a></p>';
          });
      } else if (
        ["xlsx", "xls"].includes(fileType) &&
        typeof XLSX !== "undefined"
      ) {
        // Render Excel using SheetJS
        container.innerHTML =
          '<p style="color: #666;">Loading spreadsheet...</p>';
        fetch(filePath)
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
            container.innerHTML =
              '<p style="color: #f44336;">Failed to load spreadsheet. <a href="' +
              filePath +
              '" download style="color: #0461CE;">Download instead</a></p>';
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
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;">
            <img src="${iconSrc}" alt="File Icon" style="width: 80px; height: 80px;">
            <p style="color: #666; font-size: 14px;">${doc.fileName}</p>
            <a href="${filePath}" download class="btn-download" style="padding: 10px 20px; background: #0461CE; color: white; text-decoration: none; border-radius: 6px;">Download & Open</a>
          </div>
        `;
      }
    }, 100);

    return `<div id="${containerId}" style="width: 100%; height: 100%; overflow: auto;"><p style="color: #666;">Loading...</p></div>`;
  }

  // Text files
  if (["txt", "csv", "log", "json", "xml"].includes(fileType)) {
    return `<iframe src="${filePath}" width="100%" height="100%" style="border: none; background: white;"></iframe>`;
  }

  // Fallback: show file icon with download link
  const iconSrc = doc.preview || "../assets/docs_blue.svg";
  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%;">
      <img src="${iconSrc}" alt="File Icon" style="width: 80px; height: 80px;">
      <p style="color: #666; font-size: 14px;">${doc.fileName}</p>
      <p style="color: #999; font-size: 12px;">Preview not available for .${fileType} files</p>
      <a href="${filePath}" download class="btn-download" style="padding: 10px 20px; background: #0461CE; color: white; text-decoration: none; border-radius: 6px;">Download File</a>
    </div>
  `;
}

// ========================= RENDER PREVIEW =========================
function renderPreview(doc) {
  const previewContent = document.getElementById("previewContent");
  const actionButtons = document.getElementById("actionButtons");

  const normalizeDepartment = (department) => {
    if (!department) return { label: "N/A", key: "unknown" };
    const raw = String(department).trim();
    const lower = raw.toLowerCase();

    if (lower === "hr" || lower === "human resources") {
      return { label: "HR", key: "hr" };
    }
    if (lower === "sales") {
      return { label: "Sales", key: "sales" };
    }
    if (lower === "accounting") {
      return { label: "Accounting", key: "accounting" };
    }

    return { label: raw, key: "unknown" };
  };

  const deptInfo = normalizeDepartment(doc.department);
  const deptClass = deptInfo.key ? `dept-${deptInfo.key}` : "";

  // Generate signature progress bar if document requires signature
  let signatureProgress = "";
  if (doc.requiresSignature && doc.signatories) {
    const totalSignatories = doc.signatories.length;
    const signedCount = doc.signatories.filter((s) => s.signed).length;
    const progressPercentage = (signedCount / totalSignatories) * 100;

    const signatoriesHTML = doc.signatories
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
        <a href="../e-signature/e_signature.html" class="btn-esignature">
          E-signature
        </a>
      </div>
    `;
  }

  previewContent.innerHTML = `
    ${signatureProgress}
    <div class="preview-header">
      <h3 class="preview-filename">${doc.fileName}</h3>
      <div class="preview-meta">
        <div class="meta-item">
          <span class="meta-label">Owner:</span>
          <span class="meta-value">${doc.owner}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Department:</span>
          <span class="dept-badge ${deptClass}">${deptInfo.label}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Due:</span>
          <span class="meta-value">${doc.dueDate}</span>
        </div>
      </div>
    </div>
    <div class="preview-area">
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%;">
        <span class="material-symbols-rounded" style="font-size: 80px; color: #0461CE;">description</span>
        <h3 style="color: #333; margin: 0;">${doc.fileName}</h3>
        <button class="btn-preview" data-doc-id="${doc.id}" style="padding: 12px 24px; background: #0461CE; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <span class="material-symbols-rounded">visibility</span>
          View Document
        </button>
      </div>
    </div>
  `;

  actionButtons.style.display = "flex";
}

// ========================= RENDER RECENT DOCUMENTS =========================
function renderRecentDocuments() {
  const recentList = document.getElementById("recentDocsList");

  recentList.innerHTML = "";

  if (!recentDocuments || recentDocuments.length === 0) {
    recentList.innerHTML = `
      <div class="recent-item placeholder-row">
        <p>No recent documents.</p>
      </div>
    `;
    return;
  }

  recentDocuments.forEach((doc) => {
    const item = document.createElement("div");
    item.className = "recent-item";
    item.setAttribute("data-doc-id", doc.id);
    item.setAttribute("data-department", doc.department);

    item.innerHTML = `
      <div class="file-icon">
        <img src="${doc.icon}" alt="File">
      </div>
      <div class="recent-file-info">
        <div class="recent-filename">${doc.fileName}</div>
        <div class="recent-meta">
          <span>${doc.fileSize}</span>
          <span>${doc.owner}</span>
        </div>
      </div>
      <div class="recent-date">${doc.date}</div>
    `;

    item.addEventListener("click", () => {
      console.log("Recent document clicked:", doc);
    });

    recentList.appendChild(item);
  });
}

// ========================= RENDER RECENT ACTIVITIES =========================
function renderRecentActivities() {
  const activitiesList = document.getElementById("activitiesList");

  activitiesList.innerHTML = "";

  recentActivities.forEach((activity) => {
    const item = document.createElement("div");
    item.className = "activity-item";

    const actionTextMap = {
      approved: "approved",
      rejected: "rejected",
      declined: "declined",
      returned: "returned with feedback",
      commented: "returned with feedback",
      uploaded: "uploaded",
      signed: "signed",
      modified: "modified",
      deleted: "deleted",
    };

    const actionText = actionTextMap[activity.action] || "updated";

    item.innerHTML = `
      <div class="activity-icon">
        <img src="${activity.icon}" alt="${activity.action}">
      </div>
      <div class="activity-details">
        <div class="activity-text">
          <span class="highlight">${activity.user}</span> ${actionText} 
          <span class="highlight">${activity.fileName || "document"}</span>
        </div>
        <div class="activity-time">${activity.timestamp}</div>
      </div>
    `;

    activitiesList.appendChild(item);
  });
}

// ========================= ACTION BUTTONS =========================
const actionButtons = document.querySelectorAll(".btn-action");

// Modal elements
const approvedModal = document.getElementById("approvedModal");
const declinedModal = document.getElementById("declinedModal");
const returnModal = document.getElementById("returnModal");

const approvedFilename = document.getElementById("approvedFilename");
const declinedFilename = document.getElementById("declinedFilename");
const returnFilename = document.getElementById("returnFilename");

const declinedFeedback = document.getElementById("declinedFeedback");
const returnFeedback = document.getElementById("returnFeedback");
const declinedFeedbackError = document.getElementById("declinedFeedbackError");

// Modal close buttons
const closeApprovedModal = document.getElementById("closeApprovedModal");
const closeDeclinedModal = document.getElementById("closeDeclinedModal");
const closeReturnModal = document.getElementById("closeReturnModal");

const cancelApproved = document.getElementById("cancelApproved");
const cancelDeclined = document.getElementById("cancelDeclined");
const cancelReturn = document.getElementById("cancelReturn");

// Modal confirm buttons
const confirmApproved = document.getElementById("confirmApproved");
const confirmDeclined = document.getElementById("confirmDeclined");
const confirmReturn = document.getElementById("confirmReturn");

// Open modal based on action
actionButtons.forEach((btn) => {
  btn.addEventListener("click", function () {
    const action = this.getAttribute("data-action");

    if (!selectedDocument) {
      showToast("No document selected!", "error");
      return;
    }

    const filename =
      selectedDocument.fileName || selectedDocument.name || "Unknown Document";

    if (action === "approved") {
      approvedFilename.textContent = filename;
      approvedModal.classList.add("active");
    } else if (action === "reject") {
      declinedFilename.textContent = filename;
      declinedFeedback.value = "";
      declinedFeedbackError.style.display = "none";
      declinedModal.classList.add("active");
    } else if (action === "return") {
      returnFilename.textContent = filename;
      returnFeedback.value = "";
      returnModal.classList.add("active");
    }
  });
});

// Close modal functions
function closeApprovedModalFn() {
  approvedModal.classList.remove("active");
}

function closeDeclinedModalFn() {
  declinedModal.classList.remove("active");
  declinedFeedback.value = "";
  declinedFeedbackError.style.display = "none";
}

function closeReturnModalFn() {
  returnModal.classList.remove("active");
  returnFeedback.value = "";
  const returnFeedbackError = document.getElementById("returnFeedbackError");
  if (returnFeedbackError) returnFeedbackError.style.display = "none";
}

// Attach close event listeners
closeApprovedModal.addEventListener("click", closeApprovedModalFn);
closeDeclinedModal.addEventListener("click", closeDeclinedModalFn);
closeReturnModal.addEventListener("click", closeReturnModalFn);

cancelApproved.addEventListener("click", closeApprovedModalFn);
cancelDeclined.addEventListener("click", closeDeclinedModalFn);
cancelReturn.addEventListener("click", closeReturnModalFn);

// Close on overlay click
approvedModal.addEventListener("click", (e) => {
  if (e.target === approvedModal) closeApprovedModalFn();
});

declinedModal.addEventListener("click", (e) => {
  if (e.target === declinedModal) closeDeclinedModalFn();
});

returnModal.addEventListener("click", (e) => {
  if (e.target === returnModal) closeReturnModalFn();
});

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (approvedModal.classList.contains("active")) closeApprovedModalFn();
    if (declinedModal.classList.contains("active")) closeDeclinedModalFn();
    if (returnModal.classList.contains("active")) closeReturnModalFn();
  }
});

// Confirm Approved Action
confirmApproved.addEventListener("click", async function () {
  if (!selectedDocument) {
    showToast("No document selected!", "error");
    return;
  }

  const btn = this;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="material-symbols-rounded">hourglass_empty</span> Processing...';

  try {
    const response = await fetch("../api/documents/approval_action.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: selectedDocument.id,
        action: "approved",
        feedback: "",
      }),
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message || "Document approved successfully!", "success");
      closeApprovedModalFn();

      // Remove approved document from pending list
      const index = pendingDocuments.findIndex(
        (doc) => doc.id === selectedDocument.id,
      );
      if (index > -1) {
        pendingDocuments.splice(index, 1);
        renderPendingDocuments(currentDepartmentFilter);
      }

      // Refresh dashboard data
      setTimeout(() => {
        fetchDashboardData();
      }, 500);
    } else {
      showToast(result.error || "Failed to approve document", "error");
    }
  } catch (error) {
    console.error("Error approving document:", error);
    showToast("Network error. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

// Confirm Declined Action
confirmDeclined.addEventListener("click", async function () {
  if (!selectedDocument) {
    showToast("No document selected!", "error");
    return;
  }

  const feedback = declinedFeedback.value.trim();

  // Validate feedback
  if (feedback === "") {
    declinedFeedbackError.style.display = "block";
    declinedFeedback.focus();
    return;
  }

  declinedFeedbackError.style.display = "none";

  const btn = this;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="material-symbols-rounded">hourglass_empty</span> Processing...';

  try {
    const response = await fetch("../api/documents/approval_action.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: selectedDocument.id,
        action: "declined",
        feedback: feedback,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message || "Document declined successfully!", "success");
      closeDeclinedModalFn();

      // Remove declined document from pending list
      const index = pendingDocuments.findIndex(
        (doc) => doc.id === selectedDocument.id,
      );
      if (index > -1) {
        pendingDocuments.splice(index, 1);
        renderPendingDocuments(currentDepartmentFilter);
      }

      // Refresh dashboard data
      setTimeout(() => {
        fetchDashboardData();
      }, 500);
    } else {
      showToast(result.error || "Failed to decline document", "error");
    }
  } catch (error) {
    console.error("Error declining document:", error);
    showToast("Network error. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

// Confirm Return Action
confirmReturn.addEventListener("click", async function () {
  if (!selectedDocument) {
    showToast("No document selected!", "error");
    return;
  }

  const feedback = returnFeedback.value.trim();
  const returnFeedbackError = document.getElementById("returnFeedbackError");

  // Validate feedback is required
  if (feedback === "") {
    returnFeedbackError.style.display = "block";
    returnFeedback.focus();
    return;
  }

  returnFeedbackError.style.display = "none";

  const btn = this;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<span class="material-symbols-rounded">hourglass_empty</span> Processing...';

  try {
    const response = await fetch("../api/documents/approval_action.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentId: selectedDocument.id,
        action: "return",
        feedback: feedback,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message || "Document returned for review!", "success");
      closeReturnModalFn();

      // Update document status to 'review' and keep it in the list
      const index = pendingDocuments.findIndex(
        (doc) => doc.id === selectedDocument.id,
      );
      if (index > -1) {
        pendingDocuments[index].status = "Returned";
        renderPendingDocuments(currentDepartmentFilter);
      }

      // Refresh dashboard data to get updated info
      setTimeout(() => {
        fetchDashboardData();
      }, 500);
    } else {
      showToast(result.error || "Failed to return document", "error");
    }
  } catch (error) {
    console.error("Error returning document:", error);
    showToast("Network error. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

// ========================= BACKEND API CALLS =========================
let pendingDocuments = [];
let recentDocuments = [];
let recentActivities = [];

async function fetchDashboardData() {
  try {
    const [pending, recent, activities] = await Promise.all([
      fetch("../api/documents/pending.php").then((r) => r.json()),
      fetch("../api/documents/recent.php").then((r) => r.json()),
      fetch("../api/activities/recent.php").then((r) => r.json()),
    ]);

    pendingDocuments = pending;
    recentDocuments = recent;
    recentActivities = activities;

    renderPendingDocuments("all");
    renderRecentDocuments();
    renderRecentActivities();
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  }
}

// ========================= FILE PREVIEW MODAL =========================
const previewModal = document.getElementById("previewModal");
const previewModalTitle = document.getElementById("previewModalTitle");
const previewModalContent = document.getElementById("previewModalContent");
const closePreviewModal = document.getElementById("closePreviewModal");

// Make function globally accessible for onclick
window.openFilePreview = async function (docId) {
  const doc = pendingDocuments.find((d) => d.id === docId);
  if (!doc) return;

  previewModalTitle.textContent = doc.fileName;
  previewModalContent.innerHTML =
    '<p style="text-align: center; color: #666; padding: 40px;">Loading preview...</p>';
  previewModal.classList.add("active");

  // Generate preview after modal is visible
  setTimeout(async () => {
    previewModalContent.innerHTML = generateFilePreview(doc);

    // Add signature overlay container with badge (admin view)
    if (doc.id) {
      try {
        const response = await fetch(
          `../api/signatures/get_document_signatures.php?fileId=${doc.id}`,
        );
        const signatures = await response.json();

        if (signatures.success && signatures.signatures.length > 0) {
          // Make the preview modal content container relative for positioning
          previewModalContent.style.position = "relative";

          // Add signature badge only (floating signature images removed)
          const badge = document.createElement("div");
          badge.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #0461CE;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 100;
            display: flex;
            align-items: center;
            gap: 6px;
          `;
          badge.innerHTML = `
            <span class="material-symbols-rounded" style="font-size: 18px;">draw</span>
            ${signatures.signatures.length} Signature${
              signatures.signatures.length > 1 ? "s" : ""
            }
          `;
          previewModalContent.appendChild(badge);
        }
      } catch (error) {
        console.error("Error loading signatures:", error);
      }
    }
  }, 100);
};

window.closeFilePreview = function () {
  previewModal.classList.remove("active");
  setTimeout(() => {
    previewModalContent.innerHTML = "<p>Loading preview...</p>";
  }, 300);
};

// Event delegation for View Document button
document.addEventListener("click", (e) => {
  if (e.target.closest(".btn-preview")) {
    const btn = e.target.closest(".btn-preview");
    const docId = parseInt(btn.getAttribute("data-doc-id"));
    if (docId) {
      openFilePreview(docId);
    }
  }
});

if (closePreviewModal) {
  closePreviewModal.addEventListener("click", closeFilePreview);
}

if (previewModal) {
  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) closeFilePreview();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && previewModal?.classList.contains("active")) {
    closeFilePreview();
  }
});

// ========================= INITIALIZE DASHBOARD =========================
fetchDashboardData();

// ========================= DEV HOT RELOAD =========================
function startHotReload() {
  const isLocalhost =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const params = new URLSearchParams(location.search);
  const enabled = isLocalhost || params.has("dev") || params.has("hot");

  if (!enabled) return;

  const endpoint = "../dev/reload.php";
  let lastStamp = null;

  async function checkForUpdates() {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const stamp = Number(data?.lastModified || 0);

      if (!lastStamp) {
        lastStamp = stamp;
        return;
      }

      if (stamp && stamp !== lastStamp) {
        location.reload();
      }
    } catch (error) {
      // Ignore polling errors in dev
    }
  }

  setInterval(checkForUpdates, 1000);
}

startHotReload();
