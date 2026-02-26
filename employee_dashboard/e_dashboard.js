// ========================= SIDEBAR TOGGLE =========================
const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");

if (sidebar && sidebarToggler) {
  sidebarToggler.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });
}

// ========================= LIVE DATE & TIME UPDATE =========================
function updateDateTime() {
  const now = new Date();
  const dateOptions = { month: "long", day: "numeric", weekday: "long" };
  const timeOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  const dateString = now.toLocaleDateString("en-US", dateOptions);
  const timeString = now.toLocaleTimeString("en-US", timeOptions);
  const display = document.getElementById("datetimeDisplay");
  if (display) {
    display.textContent = `${dateString} | ${timeString}`;
  }
}

updateDateTime();
setInterval(updateDateTime, 1000);

// ========================= API ENDPOINTS & STATE =========================
const API_ENDPOINTS = {
  pending: "../api/documents/pending.php",
  recentDocs: "../api/documents/recent.php",
  activities: "../api/activities/employee_recent.php",
  action: "../api/documents/action.php",
  submit: "../api/documents/submit.php",
  me: "../api/users/me.php",
  signatories: "../api/users/signatories.php",
};

let pendingDocuments = [];
let recentDocuments = [];
let recentActivities = [];
let selectedDocument = null;
let currentDepartmentFilter = "all";
let currentUser = null;
let currentEditingDocId = null;
let currentDeletingDocId = null;

// ========================= SUBMIT MODAL ELEMENTS =========================
const submitModal = document.getElementById("submitModal");
const submitForm = document.getElementById("submitForm");
const closeSubmitModalBtn = document.getElementById("closeSubmitModal");
const cancelSubmitBtn = document.getElementById("cancelSubmit");
const fileInput = document.getElementById("fileInput");
const fileNameHint = document.getElementById("fileNameHint");
const docTitle = document.getElementById("docTitle");
const docDepartment = document.getElementById("docDepartment");
const docDueDate = document.getElementById("docDueDate");
const docRequiresSignature = document.getElementById("docRequiresSignature");
const signatoriesSection = document.getElementById("signatoriesSection");
const signatoriesList = document.getElementById("signatoriesList");
const uploadButtonSelector = ".btn-upload";

// ========================= TOAST NOTIFICATION ELEMENTS =========================
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

// ========================= EDIT MODAL ELEMENTS =========================
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const closeEditModalBtn = document.getElementById("closeEditModal");
const cancelEditBtn = document.getElementById("cancelEdit");
const editDocTitle = document.getElementById("editDocTitle");
const editDocDueDate = document.getElementById("editDocDueDate");
const editDocRequiresSignature = document.getElementById(
  "editDocRequiresSignature",
);
const editSignatoriesSection = document.getElementById(
  "editSignatoriesSection",
);
const editSignatoriesList = document.getElementById("editSignatoriesList");

function openEditModal(doc) {
  currentEditingDocId = doc.id;
  editDocTitle.value = doc.fileName;
  editDocDueDate.value = doc.dueDate || "";
  editDocRequiresSignature.checked = doc.requiresSignature || false;
  toggleEditSignatoriesSection(doc);
  editModal.classList.add("active");
}

function closeEditModal() {
  editModal.classList.remove("active");
  editForm.reset();
  currentEditingDocId = null;
  if (editSignatoriesSection) editSignatoriesSection.style.display = "none";
}

// ========================= DELETE MODAL ELEMENTS =========================
const deleteModal = document.getElementById("deleteModal");
const closeDeleteModalBtn = document.getElementById("closeDeleteModal");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const deleteName = document.getElementById("deleteName");
const deleteStatus = document.getElementById("deleteStatus");

function openDeleteModal(doc) {
  currentDeletingDocId = doc.id;
  deleteName.textContent = doc.fileName;
  deleteStatus.textContent = doc.status;
  deleteModal.classList.add("active");
}

function closeDeleteModal() {
  deleteModal.classList.remove("active");
  currentDeletingDocId = null;
}

// ========================= USER CONTEXT =========================
function applyDepartmentLock(department) {
  if (!docDepartment) return;
  const allowed = ["HR", "Sales", "Accounting"];
  const normalized = department
    ? allowed.find((d) => d.toLowerCase() === department.toLowerCase()) ||
      department
    : "";

  if (normalized) {
    docDepartment.value = normalized;
    docDepartment.readOnly = true;
    docDepartment.classList.add("field-locked");
  } else {
    docDepartment.readOnly = false;
    docDepartment.classList.remove("field-locked");
  }
}

async function fetchCurrentUser() {
  try {
    const res = await fetch(API_ENDPOINTS.me, {
      headers: { "Cache-Control": "no-cache" },
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      console.warn("Unable to load current user.", data.error);
      return;
    }

    currentUser = data;
    applyDepartmentLock(currentUser.department);
  } catch (error) {
    console.warn("Unable to load current user.", error);
  }
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

    // Fetch pending documents for selected department
    fetchPendingDocuments(currentDepartmentFilter);
  });
});

// ========================= API FETCH HELPERS =========================
async function fetchPendingDocuments(department = "all") {
  const tableBody = document.getElementById("pendingDocsTableBody");
  if (tableBody) {
    tableBody.innerHTML = `
      <div class="table-row placeholder-row">
        <div class="col-full">Loading pending documents...</div>
      </div>
    `;
  }

  try {
    const response = await fetch(
      `${API_ENDPOINTS.pending}?department=${encodeURIComponent(department)}`,
      { headers: { "Cache-Control": "no-cache" } },
    );
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      tableBody.innerHTML = `
        <div class="table-row placeholder-row">
          <div class="col-full">${data?.error || "Unable to load documents."}</div>
        </div>
      `;
      return;
    }

    pendingDocuments = data;
    renderPendingDocuments();
  } catch (error) {
    if (tableBody) {
      tableBody.innerHTML = `
        <div class="table-row placeholder-row">
          <div class="col-full">Error loading documents. Please try again.</div>
        </div>
      `;
    }
  }
}

async function fetchRecentDocuments() {
  const recentList = document.getElementById("recentDocsList");
  if (recentList) {
    recentList.innerHTML = `
      <div class="recent-item placeholder-row">
        <p>Loading recent documents...</p>
      </div>
    `;
  }

  try {
    const response = await fetch(API_ENDPOINTS.recentDocs, {
      headers: { "Cache-Control": "no-cache" },
    });
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      recentList.innerHTML = `
        <div class="recent-item placeholder-row">
          <p>${data?.error || "Unable to load recent documents."}</p>
        </div>
      `;
      return;
    }

    recentDocuments = data;
    renderRecentDocuments();
  } catch (error) {
    if (recentList) {
      recentList.innerHTML = `
        <div class="recent-item placeholder-row">
          <p>Error loading recent documents.</p>
        </div>
      `;
    }
  }
}

async function fetchRecentActivities() {
  const activitiesList = document.getElementById("activitiesList");
  if (activitiesList) {
    activitiesList.innerHTML = `
      <div class="activity-item placeholder-row">
        <p>Loading recent activities...</p>
      </div>
    `;
  }

  try {
    const response = await fetch(API_ENDPOINTS.activities, {
      headers: { "Cache-Control": "no-cache" },
    });
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      activitiesList.innerHTML = `
        <div class="activity-item placeholder-row">
          <p>${data?.error || "Unable to load activities."}</p>
        </div>
      `;
      return;
    }

    recentActivities = data;
    renderRecentActivities();
  } catch (error) {
    if (activitiesList) {
      activitiesList.innerHTML = `
        <div class="activity-item placeholder-row">
          <p>Error loading activities.</p>
        </div>
      `;
    }
  }
}

// ========================= SUBMIT MODAL HELPERS =========================
function openSubmitModal() {
  if (!submitModal) return;
  submitForm?.reset();
  fileNameHint.textContent = "Select a file to upload";
  applyDepartmentLock(currentUser?.department);
  submitModal.classList.add("active");
  toggleSignatoriesSection();
}

function closeSubmitModal() {
  if (!submitModal) return;
  submitModal.classList.remove("active");
  submitForm?.reset();
  fileNameHint.textContent = "Select a file to upload";
  if (signatoriesSection) signatoriesSection.style.display = "none";
}

// ========================= SIGNATORIES =========================
async function fetchSignatories(department) {
  if (!signatoriesList) return;

  signatoriesList.innerHTML =
    '<div class="signatories-placeholder">Loading signatories...</div>';

  try {
    const res = await fetch(
      `${API_ENDPOINTS.signatories}?department=${encodeURIComponent(
        department || "all",
      )}`,
      { headers: { "Cache-Control": "no-cache" } },
    );
    const data = await res.json();

    if (!res.ok || !Array.isArray(data)) {
      signatoriesList.innerHTML =
        '<div class="signatories-empty">Unable to load signatories.</div>';
      return;
    }

    if (data.length === 0) {
      signatoriesList.innerHTML =
        '<div class="signatories-empty">No signatories available for this department.</div>';
      return;
    }

    signatoriesList.innerHTML = "";
    data.forEach((user) => {
      const option = document.createElement("label");
      option.className = "signatory-option";

      // Normalize department for badge display
      const normalizeDept = (dept) => {
        if (!dept) return "";
        const lower = dept.toLowerCase();
        if (lower === "hr" || lower === "human resources") return "HR";
        if (lower === "sales") return "Sales";
        if (lower === "accounting") return "Accounting";
        return dept;
      };

      const getDeptClass = (dept) => {
        if (!dept) return "dept-unknown";
        const lower = dept.toLowerCase();
        if (lower === "hr" || lower === "human resources") return "dept-hr";
        if (lower === "sales") return "dept-sales";
        if (lower === "accounting") return "dept-accounting";
        return "dept-unknown";
      };

      const isAdmin = user.role === "admin";
      const deptLabel = normalizeDept(user.department);
      const deptBadge =
        !isAdmin && deptLabel
          ? `<span class="dept-badge ${getDeptClass(user.department)}">${deptLabel}</span>`
          : "";

      option.innerHTML = `
        <input type="checkbox" name="signatories" value="${user.id}">
        <span class="signatory-name-wrapper">
          <span class="signatory-name">${user.name}</span>
          ${deptBadge}
        </span>
      `;
      signatoriesList.appendChild(option);
    });
  } catch (error) {
    signatoriesList.innerHTML =
      '<div class="signatories-empty">Unable to load signatories.</div>';
  }
}

function toggleSignatoriesSection() {
  if (!signatoriesSection) return;

  if (docRequiresSignature?.checked) {
    signatoriesSection.style.display = "block";
    fetchSignatories(docDepartment?.value || "all");
  } else {
    signatoriesSection.style.display = "none";
    if (signatoriesList) {
      signatoriesList.innerHTML =
        '<div class="signatories-placeholder">Select "Requires signature" to choose signatories.</div>';
    }
  }
}

async function fetchEditSignatories(department, selectedIds = []) {
  if (!editSignatoriesList) return;

  editSignatoriesList.innerHTML =
    '<div class="signatories-placeholder">Loading signatories...</div>';

  try {
    const res = await fetch(
      `${API_ENDPOINTS.signatories}?department=${encodeURIComponent(
        department || "all",
      )}`,
      { headers: { "Cache-Control": "no-cache" } },
    );
    const data = await res.json();

    if (!res.ok || !Array.isArray(data)) {
      editSignatoriesList.innerHTML =
        '<div class="signatories-empty">Unable to load signatories.</div>';
      return;
    }

    if (data.length === 0) {
      editSignatoriesList.innerHTML =
        '<div class="signatories-empty">No signatories available for this department.</div>';
      return;
    }

    editSignatoriesList.innerHTML = "";
    data.forEach((user) => {
      const option = document.createElement("label");
      option.className = "signatory-option";
      const isChecked = selectedIds.includes(Number(user.id));

      // Normalize department for badge display
      const normalizeDept = (dept) => {
        if (!dept) return "";
        const lower = dept.toLowerCase();
        if (lower === "hr" || lower === "human resources") return "HR";
        if (lower === "sales") return "Sales";
        if (lower === "accounting") return "Accounting";
        return dept;
      };

      const getDeptClass = (dept) => {
        if (!dept) return "dept-unknown";
        const lower = dept.toLowerCase();
        if (lower === "hr" || lower === "human resources") return "dept-hr";
        if (lower === "sales") return "dept-sales";
        if (lower === "accounting") return "dept-accounting";
        return "dept-unknown";
      };

      const isAdmin = user.role === "admin";
      const deptLabel = normalizeDept(user.department);
      const deptBadge =
        !isAdmin && deptLabel
          ? `<span class="dept-badge ${getDeptClass(user.department)}">${deptLabel}</span>`
          : "";

      option.innerHTML = `
        <input type="checkbox" name="editSignatories" value="${user.id}" ${
          isChecked ? "checked" : ""
        }>
        <span class="signatory-name-wrapper">
          <span class="signatory-name">${user.name}</span>
          ${deptBadge}
        </span>
      `;
      editSignatoriesList.appendChild(option);
    });
  } catch (error) {
    editSignatoriesList.innerHTML =
      '<div class="signatories-empty">Unable to load signatories.</div>';
  }
}

function toggleEditSignatoriesSection(doc = null) {
  if (!editSignatoriesSection) return;

  if (editDocRequiresSignature?.checked) {
    editSignatoriesSection.style.display = "block";
    const selectedIds = doc?.signatories
      ? doc.signatories
          .map((s) => Number(s.userId))
          .filter((id) => Number.isFinite(id))
      : [];
    fetchEditSignatories(
      doc?.department || docDepartment?.value || "all",
      selectedIds,
    );
  } else {
    editSignatoriesSection.style.display = "none";
    if (editSignatoriesList) {
      editSignatoriesList.innerHTML =
        '<div class="signatories-placeholder">Select "Requires signature" to choose signatories.</div>';
    }
  }
}

async function fetchDashboardData() {
  await Promise.all([
    fetchPendingDocuments(currentDepartmentFilter),
    fetchRecentDocuments(),
    fetchRecentActivities(),
  ]);
}

// ========================= RENDER PENDING DOCUMENTS =========================
function renderPendingDocuments() {
  const tableBody = document.getElementById("pendingDocsTableBody");

  if (!pendingDocuments || pendingDocuments.length === 0) {
    tableBody.innerHTML = `
      <div class="table-row placeholder-row">
        <div class="col-full">No pending documents found for this department.</div>
      </div>
    `;
    return;
  }

  tableBody.innerHTML = "";

  pendingDocuments.forEach((doc, index) => {
    const row = document.createElement("div");
    row.className = "table-row";
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
      <div class="col-actions">
        <button class="btn-inline btn-inline-edit" type="button" aria-label="Edit document">
          <span class="material-symbols-rounded">edit</span>
        </button>
        <button class="btn-inline btn-inline-delete" type="button" aria-label="Delete document">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>
    `;

    row.addEventListener("click", () => selectDocument(doc, row));

    const editBtn = row.querySelector(".btn-inline-edit");
    if (editBtn) {
      editBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        handleEdit(doc.id);
      });
    }

    const deleteBtn = row.querySelector(".btn-inline-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        handleDelete(doc.id);
      });
    }

    tableBody.appendChild(row);
  });
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
        <button class="btn-preview" onclick="openFilePreview(${doc.id})" style="padding: 12px 24px; background: #0461CE; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <span class="material-symbols-rounded">visibility</span>
          View Document
        </button>
      </div>
    </div>
  `;

  actionButtons.style.display = "flex";

  // Hide submit section when document is selected
  const submitSection = document.getElementById("submitSection");
  if (submitSection) {
    submitSection.style.display = "none";
  }
}

// ========================= UPLOAD STATE (NO SELECTION) =========================
function showUploadState() {
  const previewContent = document.getElementById("previewContent");
  const actionButtons = document.getElementById("actionButtons");
  const submitSection = document.getElementById("submitSection");

  if (previewContent) {
    previewContent.innerHTML = `
      <div class="upload-section">
        <button class="btn-upload">
          <span class="material-symbols-rounded">upload_file</span>
          Upload your file
        </button>
        <p class="upload-hint">
          Or Drop the File, paste the file with <span class="keyboard-shortcut">Ctrl + V</span>
        </p>
      </div>
    `;
  }

  if (actionButtons) {
    actionButtons.style.display = "none";
  }

  if (submitSection) {
    submitSection.style.display = "flex";
  }

  selectedDocument = null;
}

// ========================= SUBMIT DOCUMENT BUTTON =========================
const btnSubmitDocs = document.getElementById("btnSubmitDocs");
if (btnSubmitDocs) {
  btnSubmitDocs.addEventListener("click", () => {
    document.querySelectorAll(".table-row").forEach((row) => {
      row.classList.remove("selected");
    });
    selectedDocument = null;
    openSubmitModal();
    // Auto-trigger file chooser for convenience
    setTimeout(() => fileInput?.click(), 80);
  });
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

  if (!recentActivities || recentActivities.length === 0) {
    activitiesList.innerHTML = `
      <div class="activity-item placeholder-row">
        <p>No recent activities.</p>
      </div>
    `;
    return;
  }

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

async function performDocumentAction(documentId, action) {
  if (!documentId || !action) return;

  const res = await fetch(API_ENDPOINTS.action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId, action }),
  });

  const data = await res.json();

  if (!res.ok || data.success === false) {
    showToast(data.error || "Action failed. Please try again.", "error");
    return;
  }

  await fetchPendingDocuments(currentDepartmentFilter);
  showUploadState();
  showToast(data.message || "Action completed successfully.", "success");
}

actionButtons.forEach((btn) => {
  btn.addEventListener("click", async function () {
    const action = this.getAttribute("data-action");

    if (!selectedDocument) {
      showToast("No document selected!", "error");
      return;
    }

    const confirmMessage =
      action === "resubmit"
        ? `Resubmit document "${selectedDocument.fileName}"?`
        : `Process document "${selectedDocument.fileName}"?`;

    if (!confirm(confirmMessage)) return;

    // Map front-end action to backend action endpoint
    const backendAction = action === "resubmit" ? "return" : action;

    await performDocumentAction(selectedDocument.id, backendAction);
  });
});

// ========================= SUBMIT MODAL EVENTS =========================
if (docRequiresSignature) {
  docRequiresSignature.addEventListener("change", toggleSignatoriesSection);
}

if (docDepartment) {
  docDepartment.addEventListener("change", () => {
    if (docRequiresSignature?.checked) {
      fetchSignatories(docDepartment.value);
    }
  });
}

if (editDocRequiresSignature) {
  editDocRequiresSignature.addEventListener("change", () => {
    const doc = pendingDocuments.find((d) => d.id === currentEditingDocId);
    toggleEditSignatoriesSection(doc || selectedDocument);
  });
}

if (fileInput) {
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      const selectedName = fileInput.files[0].name;
      fileNameHint.textContent = selectedName;
      docTitle.value = selectedName;
    } else {
      fileNameHint.textContent = "Select a file to upload";
    }
  });
}

if (submitForm) {
  submitForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      showToast("Please choose a file to upload.", "error");
      return;
    }

    if (!docTitle.value.trim() || !docDepartment.value) {
      showToast("Please complete title and department.", "error");
      return;
    }

    let selectedSignatories = [];
    if (docRequiresSignature.checked && signatoriesList) {
      selectedSignatories = Array.from(
        signatoriesList.querySelectorAll('input[name="signatories"]:checked'),
      ).map((input) => Number(input.value));

      if (selectedSignatories.length === 0) {
        showToast("Please select at least one signatory.", "error");
        return;
      }
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("title", docTitle.value.trim());
    formData.append("department", docDepartment.value);
    formData.append("dueDate", docDueDate.value || "");
    formData.append(
      "requiresSignature",
      docRequiresSignature.checked ? "1" : "0",
    );
    if (docRequiresSignature.checked) {
      formData.append("signatories", JSON.stringify(selectedSignatories));
    }

    const saveBtn = document.getElementById("saveSubmit");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Submitting...";
    }

    try {
      const res = await fetch(API_ENDPOINTS.submit, {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", res.status);
      console.log("Response OK:", res.ok);

      const data = await res.json();
      console.log("Response data:", data);

      if (!res.ok || data.success === false) {
        showToast(
          data.error || "Could not submit document. Please try again.",
          "error",
        );
        return;
      }

      showToast(data.message || "Document submitted successfully.", "success");
      closeSubmitModal();
      await fetchPendingDocuments(currentDepartmentFilter);
      showUploadState();
    } catch (error) {
      console.error("Submit error:", error);
      showToast("Network error. Please try again.", "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Submit";
      }
    }
  });
}

// Upload buttons (in preview upload state) trigger the submit modal and file chooser
document.addEventListener("click", (e) => {
  const btn = e.target.closest(uploadButtonSelector);
  if (!btn) return;
  e.preventDefault();
  openSubmitModal();
  setTimeout(() => fileInput?.click(), 80);
});

if (closeSubmitModalBtn) {
  closeSubmitModalBtn.addEventListener("click", closeSubmitModal);
}
if (cancelSubmitBtn) {
  cancelSubmitBtn.addEventListener("click", closeSubmitModal);
}
if (submitModal) {
  submitModal.addEventListener("click", (e) => {
    if (e.target === submitModal) closeSubmitModal();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && submitModal?.classList.contains("active")) {
    closeSubmitModal();
  }
});

// ========================= EDIT MODAL EVENT LISTENERS =========================
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!editDocTitle.value.trim()) {
      showToast("Please enter a title.", "error");
      return;
    }

    let selectedEditSignatories = [];
    if (editDocRequiresSignature.checked && editSignatoriesList) {
      selectedEditSignatories = Array.from(
        editSignatoriesList.querySelectorAll(
          'input[name="editSignatories"]:checked',
        ),
      ).map((input) => Number(input.value));

      if (selectedEditSignatories.length === 0) {
        showToast("Please select at least one signatory.", "error");
        return;
      }
    }

    const saveBtn = document.getElementById("saveEdit");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
    }

    try {
      const res = await fetch("../api/documents/action.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: currentEditingDocId,
          action: "update",
          title: editDocTitle.value.trim(),
          dueDate: editDocDueDate.value || null,
          requiresSignature: editDocRequiresSignature.checked ? 1 : 0,
          signatories: editDocRequiresSignature.checked
            ? selectedEditSignatories
            : [],
        }),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        showToast(data.error || "Failed to update document.", "error");
        return;
      }

      showToast(data.message || "Document updated successfully.", "success");
      closeEditModal();
      await fetchPendingDocuments(currentDepartmentFilter);
    } catch (error) {
      console.error("Edit error:", error);
      showToast("Network error. Please try again.", "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
      }
    }
  });
}

if (closeEditModalBtn) {
  closeEditModalBtn.addEventListener("click", closeEditModal);
}
if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", closeEditModal);
}
if (editModal) {
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
  });
}

// ========================= DELETE MODAL EVENT LISTENERS =========================
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener("click", async () => {
    if (!currentDeletingDocId) return;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = "Deleting...";

    try {
      const res = await fetch("../api/documents/action.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: currentDeletingDocId,
          action: "delete",
        }),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        showToast(data.error || "Failed to delete document.", "error");
        return;
      }

      showToast(data.message || "Document deleted successfully.", "success");
      closeDeleteModal();
      await fetchPendingDocuments(currentDepartmentFilter);
      showUploadState();
    } catch (error) {
      console.error("Delete error:", error);
      showToast("Network error. Please try again.", "error");
    } finally {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = "Delete Document";
    }
  });
}

if (closeDeleteModalBtn) {
  closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
}
if (cancelDeleteBtn) {
  cancelDeleteBtn.addEventListener("click", closeDeleteModal);
}
if (deleteModal) {
  deleteModal.addEventListener("click", (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });
}

// ========================= FILE PREVIEW MODAL =========================
const previewModal = document.getElementById("previewModal");
const previewModalTitle = document.getElementById("previewModalTitle");
const previewModalContent = document.getElementById("previewModalContent");
const closePreviewModal = document.getElementById("closePreviewModal");

async function openFilePreview(docId) {
  const doc = pendingDocuments.find((d) => d.id === docId);
  if (!doc) return;

  previewModalTitle.textContent = doc.fileName;
  previewModalContent.innerHTML =
    '<p style="text-align: center; color: #666; padding: 40px;">Loading preview...</p>';
  previewModal.classList.add("active");

  // Generate preview after modal is visible with signatures
  setTimeout(async () => {
    const basePreview = generateFilePreview(doc);

    // Create container for preview with signatures
    const previewContainer = document.createElement("div");
    previewContainer.style.position = "relative";
    previewContainer.style.width = "100%";
    previewContainer.style.height = "100%";
    previewContainer.innerHTML = basePreview;

    // Fetch and overlay signatures
    try {
      const response = await fetch(
        `../api/signatures/get_document_signatures.php?fileId=${doc.id}`,
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

    previewModalContent.innerHTML = "";
    previewModalContent.appendChild(previewContainer);
  }, 100);
}

function closeFilePreview() {
  previewModal.classList.remove("active");
  setTimeout(() => {
    previewModalContent.innerHTML = "<p>Loading preview...</p>";
  }, 300);
}

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
(async function initDashboard() {
  await fetchCurrentUser();
  await fetchDashboardData();
  showUploadState();
})();

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

// ========================= INLINE EDIT/DELETE HANDLERS =========================
function handleEdit(docId) {
  const doc = pendingDocuments.find((d) => d.id === docId);
  if (!doc) return;
  openEditModal(doc);
}

function handleDelete(docId) {
  const doc = pendingDocuments.find((d) => d.id === docId);
  if (!doc) return;
  openDeleteModal(doc);
}

// ========================= BACKEND-READY FETCH PATTERN =========================
/*
async function fetchDashboardData() {
  try {
    const [pending, recent, activities] = await Promise.all([
      fetch('/api/documents/pending.php').then(r => r.json()),
      fetch('/api/documents/recent.php').then(r => r.json()),
      fetch('/api/activities/recent.php').then(r => r.json())
    ]);
    
    renderPendingDocuments('all', pending);
    renderRecentDocuments(recent);
    renderRecentActivities(activities);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  }
}

fetchDashboardData();
*/
