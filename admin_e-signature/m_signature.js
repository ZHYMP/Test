const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");

// Only the collapse/expand functionality remains (works on all screens)
sidebarToggler.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});

// ========================= TOAST NOTIFICATIONS =========================
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = {
    success: "check_circle",
    error: "error",
    warning: "warning",
    info: "info",
  };

  const titles = {
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info",
  };

  toast.innerHTML = `
    <span class="material-symbols-rounded toast-icon">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-title">${titles[type]}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto remove after duration
  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 300);
  }, duration);

  // Click to dismiss
  toast.addEventListener("click", () => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 300);
  });
}

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

// ========================= STATE & DATA =========================
let documentsData = [];
let currentUserName = ""; // Fetched from API
let savedSignatures = []; // Saved signatures from database
let selectedSavedSignatureId = null; // Currently selected saved signature

let selectedFileId = null;
let signatureMethod = "draw";
let uploadedSignature = null;
let selectedDocument = null;
let currentSignatureData = null;
let signaturePlacement = { x: 0, y: 0 };

// ========================= FETCH SAVED SIGNATURES =========================
async function fetchSavedSignatures() {
  try {
    const response = await fetch("../api/signatures/saved.php");
    const data = await response.json();

    if (data.success) {
      savedSignatures = data.signatures;
      renderSavedSignatures();
    } else {
      console.error("Error loading saved signatures:", data.error);
    }
  } catch (error) {
    console.error("Error fetching saved signatures:", error);
  }
}

// ========================= RENDER SAVED SIGNATURES =========================
function renderSavedSignatures() {
  const container = document.getElementById("savedSignaturesContainer");

  if (savedSignatures.length === 0) {
    container.innerHTML = `
      <div class="no-saved-signatures">
        <span class="material-symbols-rounded">bookmark_border</span>
        <p>No saved signatures yet</p>
        <p style="font-size: 12px; margin-top: 8px;">Draw or upload a signature and check "Save for future use"</p>
      </div>
    `;
    return;
  }

  container.innerHTML = savedSignatures
    .map(
      (sig) => `
    <div class="saved-signature-item ${selectedSavedSignatureId === sig.id ? "selected" : ""}" 
         data-signature-id="${sig.id}" 
         onclick="selectSavedSignature(${sig.id})">
      <img src="../${sig.path}" alt="${sig.name}" />
      <div class="saved-signature-name">${sig.name}</div>
      <div class="saved-signature-meta">${sig.createdDate}</div>
      <button class="saved-signature-delete" onclick="event.stopPropagation(); deleteSavedSignature(${sig.id})">
        <span class="material-symbols-rounded">delete</span>
      </button>
    </div>
  `,
    )
    .join("");
}

// ========================= SELECT SAVED SIGNATURE =========================
function selectSavedSignature(signatureId) {
  selectedSavedSignatureId = signatureId;
  const signature = savedSignatures.find((s) => s.id === signatureId);

  if (signature) {
    // Load signature data
    fetch(`../${signature.path}`)
      .then((response) => response.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          uploadedSignature = e.target.result;
          currentSignatureData = e.target.result;
          document.getElementById("submitSignature").disabled = false;
        };
        reader.readAsDataURL(blob);
      });

    renderSavedSignatures();
  }
}

window.selectSavedSignature = selectSavedSignature;

// ========================= DELETE SAVED SIGNATURE =========================
let signatureToDelete = null;

function deleteSavedSignature(signatureId) {
  signatureToDelete = signatureId;
  const modal = document.getElementById("deleteConfirmModal");
  if (modal) {
    modal.classList.add("active");
  }
}

function closeDeleteConfirmModal() {
  const modal = document.getElementById("deleteConfirmModal");
  if (modal) {
    modal.classList.remove("active");
  }
  signatureToDelete = null;
}

async function confirmDeleteSignature() {
  if (!signatureToDelete) return;

  const signatureId = signatureToDelete;
  closeDeleteConfirmModal();

  try {
    const response = await fetch("../api/signatures/saved.php", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signatureId }),
    });

    const data = await response.json();

    if (data.success) {
      alert("Signature deleted successfully!");
      await fetchSavedSignatures();

      if (selectedSavedSignatureId === signatureId) {
        selectedSavedSignatureId = null;
        uploadedSignature = null;
        document.getElementById("submitSignature").disabled = true;
      }
    } else {
      showToast("Failed to delete signature: " + data.error, "error");
    }
  } catch (error) {
    console.error("Error deleting signature:", error);
    showToast("Error deleting signature. Please try again.", "error");
  }
}

window.deleteSavedSignature = deleteSavedSignature;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;
window.confirmDeleteSignature = confirmDeleteSignature;

// ========================= SAVE SIGNATURE FOR FUTURE USE =========================
async function saveSignatureForFuture(signatureName, signatureData, method) {
  try {
    const response = await fetch("../api/signatures/saved.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signatureName,
        signatureData,
        method,
        setAsDefault: false,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Refresh saved signatures list
      await fetchSavedSignatures();
    } else {
      console.error("Failed to save signature:", data.error);
    }
  } catch (error) {
    console.error("Error saving signature:", error);
  }
}

// ========================= CHECKBOX EVENT LISTENERS =========================
document
  .getElementById("saveSignatureCheck")
  .addEventListener("change", (e) => {
    const nameInput = document.getElementById("signatureNameInput");
    if (e.target.checked) {
      nameInput.style.display = "block";
      nameInput.focus();
    } else {
      nameInput.style.display = "none";
      nameInput.value = "";
    }
  });

document
  .getElementById("saveUploadedSignatureCheck")
  .addEventListener("change", (e) => {
    const nameInput = document.getElementById("uploadedSignatureNameInput");
    if (e.target.checked) {
      nameInput.style.display = "block";
      nameInput.focus();
    } else {
      nameInput.style.display = "none";
      nameInput.value = "";
    }
  });

// ========================= FETCH DOCUMENTS FROM API =========================
async function fetchSignatoryDocuments() {
  try {
    const response = await fetch("../api/documents/signatories.php");
    const data = await response.json();

    if (data.error) {
      console.error("API Error:", data.error);
      document.getElementById("filesList").innerHTML =
        '<p class="no-files">Error loading documents</p>';
      return;
    }

    documentsData = data;
    renderFiles();
  } catch (error) {
    console.error("Error fetching documents:", error);
    document.getElementById("filesList").innerHTML =
      '<p class="no-files">Failed to load documents</p>';
  }
}

// ========================= RENDER FILES =========================
function renderFiles() {
  const filesList = document.getElementById("filesList");

  // Filter files that require current user's signature (not yet signed) AND not declined/approved
  const pendingFiles = documentsData.filter(
    (file) =>
      !file.currentUserSigned &&
      file.status !== "declined" &&
      file.status !== "approved",
  );

  if (pendingFiles.length === 0) {
    filesList.innerHTML =
      '<p class="no-files">No documents require your signature</p>';
    return;
  }

  filesList.innerHTML = pendingFiles
    .map((file) => {
      const signedCount = file.signatories.filter((s) => s.signed).length;
      const totalCount = file.signatories.length;

      return `
        <div class="file-item" data-file-id="${file.id}">
          <div class="file-header">
            <div class="file-icon ${file.type}">
              <span class="material-symbols-rounded">description</span>
            </div>
            <div class="file-info">
              <div class="file-name">${file.fileName}</div>
              <div class="file-meta">Owner: ${file.owner} | ${file.uploadDate}</div>
            </div>
            <span class="signature-badge">${signedCount}/${totalCount}</span>
          </div>
        </div>
      `;
    })
    .join("");

  // Add click handlers
  document.querySelectorAll(".file-item").forEach((item) => {
    item.addEventListener("click", () => {
      const fileId = parseInt(item.dataset.fileId);
      selectFile(fileId);
    });
  });
}

// ========================= SELECT FILE & SHOW PREVIEW =========================
function selectFile(fileId) {
  const file = documentsData.find((f) => f.id === fileId);
  if (!file) return;

  selectedDocument = file;

  // Update selected state
  document.querySelectorAll(".file-item").forEach((item) => {
    item.classList.remove("selected");
  });
  document
    .querySelector(`[data-file-id="${fileId}"]`)
    .classList.add("selected");

  // Show document preview
  const preview = document.getElementById("documentPreview");
  const details = document.getElementById("documentDetails");

  // Generate signatories HTML with dashboard design
  const signedCount = file.signatories.filter((s) => s.signed).length;
  const totalCount = file.signatories.length;
  const progressPercentage = (signedCount / totalCount) * 100;

  const signatoriesHTML = file.signatories
    .map((signatory) => {
      const statusClass = signatory.signed ? "signed" : "pending";
      const icon = signatory.signed ? "check_circle" : "person";
      const dateText = signatory.signed
        ? `Signed: ${signatory.signedDate}`
        : "Pending";

      return `
        <div class="signatory-item ${statusClass}">
          <div class="signatory-avatar">
            <span class="material-symbols-rounded">${icon}</span>
          </div>
          <div class="signatory-info">
            <div class="signatory-name">${signatory.name}</div>
            <div class="signatory-status">${dateText}</div>
          </div>
        </div>
      `;
    })
    .join("");

  // Show preview with View Document and Sign Now buttons
  preview.innerHTML = `
    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 20px; padding: 40px;">
      <span class="material-symbols-rounded" style="font-size: 100px; color: #0461CE;">description</span>
      <p style="color: #666; font-size: 20px; font-weight: 600; text-align: center;">${file.fileName}</p>
      <div style="display: flex; gap: 12px; margin-top: 10px;" id="docActionButtons">
        <button class="btn-view-doc" data-doc-id="${fileId}" style="padding: 14px 32px; background: #fff; color: #0461CE; border: 2px solid #0461CE; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px;">
          <span class="material-symbols-rounded" style="vertical-align: middle;">visibility</span>
          View Document
        </button>
        <button class="btn-sign-now" onclick="openSignaturePanel(${fileId})" style="padding: 14px 32px; background: linear-gradient(135deg, #0461CE, #0474E5); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(4, 97, 206, 0.3); transition: all 0.3s ease; display: flex; align-items: center; gap: 8px;">
          <span class="material-symbols-rounded" style="vertical-align: middle;">draw</span>
          Sign Now
        </button>
      </div>
    </div>
  `;

  // Attach View Document button event listener (like file repository pattern)
  const viewDocBtn = preview.querySelector(".btn-view-doc");
  if (viewDocBtn) {
    viewDocBtn.addEventListener("click", () => {
      console.log("View Document clicked for:", file.fileName);
      openFilePreview(file);
    });
  }

  // Show document details with dashboard-style signature progress
  document.getElementById("detailDocName").textContent = file.fileName;
  document.getElementById("detailOwner").textContent = file.owner;
  document.getElementById("detailDate").textContent = file.uploadDate;

  const departmentPill = document.getElementById("detailDepartment");
  departmentPill.textContent = file.department || "N/A";
  departmentPill.className =
    "department-pill " +
    (file.department ? file.department.toLowerCase() : "unknown");

  document.getElementById("detailSignatures").innerHTML = `
    <div class="signature-progress-section">
      <div class="signature-header">
        <h4 class="signature-title">
          <span class="material-symbols-rounded">draw</span>
          Signature Progress
        </h4>
        <div class="signature-count">${signedCount} of ${totalCount} signed</div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
      </div>
      <div class="signatories-list">
        ${signatoriesHTML}
      </div>
    </div>
  `;

  details.style.display = "block";
}

// ========================= SIGNATURE PANEL =========================
function openSignaturePanel(fileId) {
  selectedFileId = fileId;
  const file = documentsData.find((f) => f.id === fileId);

  if (!file) return;

  // Hide preview card and show signature card
  document.getElementById("previewCard").style.display = "none";
  document.getElementById("signatureCard").style.display = "flex";

  // Reset signature
  clearCanvas();
  uploadedSignature = null;
  document.getElementById("signaturePreview").innerHTML = "";
  document.getElementById("submitSignature").disabled = true;
}

window.openSignaturePanel = openSignaturePanel;

function closeSignaturePanel() {
  document.getElementById("previewCard").style.display = "flex";
  document.getElementById("signatureCard").style.display = "none";
  selectedFileId = null;
  clearCanvas();
  uploadedSignature = null;
}

// ========================= SIGNATURE METHOD TABS =========================
const tabButtons = document.querySelectorAll(".tab-btn");
const savedSection = document.getElementById("savedSection");
const drawSection = document.getElementById("drawSection");
const uploadSection = document.getElementById("uploadSection");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((tab) => tab.classList.remove("active"));
    btn.classList.add("active");

    signatureMethod = btn.dataset.method;

    if (signatureMethod === "saved") {
      savedSection.style.display = "block";
      drawSection.style.display = "none";
      uploadSection.style.display = "none";
      fetchSavedSignatures();
    } else if (signatureMethod === "draw") {
      savedSection.style.display = "none";
      drawSection.style.display = "block";
      uploadSection.style.display = "none";
    } else if (signatureMethod === "upload") {
      savedSection.style.display = "none";
      drawSection.style.display = "none";
      uploadSection.style.display = "block";
    }

    // Reset submit button
    document.getElementById("submitSignature").disabled = true;
    selectedSavedSignatureId = null;
  });
});

// ========================= CANVAS DRAWING =========================
const canvas = document.getElementById("signatureCanvas");
const ctx = canvas.getContext("2d");
let isDrawing = false;
let hasDrawn = false;

// Set canvas size
function resizeCanvas() {
  const container = canvas.parentElement;
  // Account for container padding (16px * 2 = 32px)
  // Double the resolution for smoother drawing
  canvas.width = (container.clientWidth - 32) * 2;
  canvas.height = 300 * 2;
  // Scale the canvas back down for display
  canvas.style.width = container.clientWidth - 32 + "px";
  canvas.style.height = "300px";

  // Enable smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Drawing settings
let penColor = "#000000";
let penSize = 4; // Doubled for high-DPI canvas

document.getElementById("penColor").addEventListener("change", (e) => {
  penColor = e.target.value;
});

document.getElementById("penSize").addEventListener("input", (e) => {
  penSize = parseInt(e.target.value);
});

// Mouse events
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);

// Touch events for mobile
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousedown", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousemove", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  const mouseEvent = new MouseEvent("mouseup", {});
  canvas.dispatchEvent(mouseEvent);
});

function startDrawing(e) {
  isDrawing = true;
  hasDrawn = true;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  ctx.beginPath();
  ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);

  // Enable submit button when drawing starts
  document.getElementById("submitSignature").disabled = false;
}

function draw(e) {
  if (!isDrawing) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  ctx.strokeStyle = penColor;
  ctx.lineWidth = penSize;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasDrawn = false;
  document.getElementById("submitSignature").disabled = true;
}

document.getElementById("clearCanvas").addEventListener("click", clearCanvas);

// ========================= UPLOAD SIGNATURE (PNG only) =========================
const uploadBtn = document.getElementById("uploadBtn");
const signatureUpload = document.getElementById("signatureUpload");
const signaturePreview = document.getElementById("signaturePreview");

// Change to PNG only
signatureUpload.setAttribute("accept", "image/png");

uploadBtn.addEventListener("click", () => {
  signatureUpload.click();
});

signatureUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];

  if (!file) return;

  // Check file type (PNG only)
  if (!file.type.startsWith("image/png")) {
    showToast("Please upload a PNG image file only", "warning");
    return;
  }

  // Check file size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    showToast("File size must be less than 2MB", "warning");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      // Remove background using canvas
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple background removal (remove white/near-white pixels)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // If pixel is white or near-white, make it transparent
        if (r > 240 && g > 240 && b > 240) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
        }
      }

      ctx.putImageData(imageData, 0, 0);
      uploadedSignature = canvas.toDataURL("image/png");

      signaturePreview.innerHTML = `<img src="${uploadedSignature}" alt="Signature Preview" style="max-width: 100%; border: 2px solid #0461CE; border-radius: 8px; padding: 10px; background: white;">`;
      document.getElementById("submitSignature").disabled = false;
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// ========================= SUBMIT SIGNATURE (Show Preview Modal) =========================
document
  .getElementById("submitSignature")
  .addEventListener("click", async () => {
    if (!selectedFileId) return;

    if (signatureMethod === "saved") {
      if (!selectedSavedSignatureId) {
        showToast("Please select a saved signature", "warning");
        return;
      }
      // Ensure currentSignatureData is set from the selected saved signature
      if (!currentSignatureData) {
        showToast("Signature data is still loading. Please try again.", "info");
        return;
      }
    } else if (signatureMethod === "draw") {
      if (!hasDrawn) {
        showToast("Please draw your signature first", "warning");
        return;
      }
      currentSignatureData = canvas.toDataURL("image/png");

      // Check if user wants to save this signature (validate but don't block preview)
      const shouldSave = document.getElementById("saveSignatureCheck").checked;
      if (shouldSave) {
        const signatureName = document
          .getElementById("signatureNameInput")
          .value.trim();
        if (signatureName) {
          // Only save if name is provided
          await saveSignatureForFuture(
            signatureName,
            currentSignatureData,
            "draw",
          );
        }
        // If no name provided, signature will still work but won't be saved
      }
    } else if (signatureMethod === "upload") {
      if (!uploadedSignature) {
        showToast("Please upload a signature image", "warning");
        return;
      }
      currentSignatureData = uploadedSignature;

      // Check if user wants to save this signature (validate but don't block preview)
      const shouldSave = document.getElementById(
        "saveUploadedSignatureCheck",
      ).checked;
      if (shouldSave) {
        const signatureName = document
          .getElementById("uploadedSignatureNameInput")
          .value.trim();
        if (signatureName) {
          // Only save if name is provided
          await saveSignatureForFuture(
            signatureName,
            currentSignatureData,
            "upload",
          );
        }
        // If no name provided, signature will still work but won't be saved
      }
    }

    // Show signature preview modal
    showSignaturePreviewModal();
  });

// ========================= CLOSE/CANCEL BUTTONS =========================
document
  .getElementById("closeSignature")
  .addEventListener("click", closeSignaturePanel);
document
  .getElementById("cancelSignature")
  .addEventListener("click", closeSignaturePanel);

// ========================= FILE PREVIEW GENERATOR (API-BASED LIKE FILE REPOSITORY) =========================
function generateFilePreview(doc) {
  const fileType = doc.type ? doc.type.toLowerCase() : "";
  const fileId = doc.id;

  // If no file ID, show placeholder
  if (!fileId) {
    const iconSrc = doc.preview || "../assets/docs_blue.svg";
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%;">
        <img src="${iconSrc}" alt="File Icon" style="width: 80px; height: 80px;">
        <p style="color: #666; font-size: 14px;">No file uploaded yet or preview not available</p>
        <p style="color: #999; font-size: 12px;">File Type: ${fileType || "unknown"}</p>
      </div>
    `;
  }

  // Get base path for API (matches file repository pattern)
  const basePath = window.location.pathname.split("/")[1];

  // Use preview API endpoint for inline viewing (same as file repository)
  // Add cache-busting parameter to force reload after signatures are embedded
  const cacheBuster = doc.modifiedDate
    ? `&v=${encodeURIComponent(doc.modifiedDate)}`
    : `&t=${Date.now()}`;
  const filePath = `/${basePath}/api/files/preview.php?id=${fileId}${cacheBuster}`;

  console.log("Generating preview for document:", {
    fileName: doc.fileName,
    fileType: fileType,
    fileId: fileId,
    filePath: filePath,
  });

  // PDF files - use iframe for better compatibility
  if (fileType === "pdf") {
    return `<iframe src="${filePath}#view=FitH" type="application/pdf" width="100%" height="100%" style="border: none; background: #e8e8e8;"></iframe>`;
  }

  // Image files
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(fileType)) {
    return `<img src="${filePath}" alt="Document Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
  }

  // Office documents (DOCX, XLSX)
  if (["docx", "xlsx", "xls"].includes(fileType)) {
    const containerId = "doc-preview-" + Date.now();

    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (
        (fileType === "docx" || fileType === "doc") &&
        typeof mammoth !== "undefined"
      ) {
        container.innerHTML =
          '<p style="color: #666; text-align: center; padding: 40px;">Loading document...</p>';
        fetch(filePath)
          .then((res) => res.arrayBuffer())
          .then((arrayBuffer) => mammoth.convertToHtml({ arrayBuffer }))
          .then((result) => {
            container.innerHTML = `
              <div style="padding: 40px 60px; background: white; max-width: 850px; margin: 20px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 4px; min-height: 600px; line-height: 1.6; font-family: 'Times New Roman', serif; font-size: 14px;">
                ${result.value}
              </div>
            `;
          })
          .catch((err) => {
            console.error("DOCX render error:", err);
            container.innerHTML =
              '<p style="color: #f44336; text-align: center; padding: 40px;">Failed to load document preview. <a href="' +
              filePath +
              '" download style="color: #0461CE; text-decoration: underline;">Download instead</a></p>';
          });
      } else if (
        (fileType === "xlsx" || fileType === "xls") &&
        typeof XLSX !== "undefined"
      ) {
        container.innerHTML =
          '<p style="color: #666; text-align: center; padding: 40px;">Loading spreadsheet...</p>';
        fetch(filePath)
          .then((res) => res.arrayBuffer())
          .then((arrayBuffer) => {
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const html = XLSX.utils.sheet_to_html(firstSheet);
            container.innerHTML = `<div style="padding: 30px; background: white; overflow: auto;"><div style="overflow-x: auto;">${html}</div></div>`;
          })
          .catch((err) => {
            console.error("SheetJS error:", err);
            container.innerHTML =
              '<p style="color: #f44336; text-align: center; padding: 40px;">Failed to load spreadsheet preview. <a href="' +
              filePath +
              '" download style="color: #0461CE; text-decoration: underline;">Download instead</a></p>';
          });
      } else {
        // Library not loaded - show fallback
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 60px;">
            <span class="material-symbols-rounded" style="font-size: 80px; color: #0461CE;">description</span>
            <p style="color: #666; font-size: 16px; text-align: center;">${doc.fileName}</p>
            <p style="color: #999; font-size: 14px;">Preview library not loaded for .${fileType} files</p>
            <a href="${filePath}" download class="btn-download" style="padding: 12px 24px; background: #0461CE; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Download File</a>
          </div>
        `;
      }
    }, 100);

    return `<div id="${containerId}" style="width: 100%; height: 100%; overflow: auto;"><p style="color: #666; text-align: center; padding: 40px;">Loading...</p></div>`;
  }

  // Fallback
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

// ========================= EVENT DELEGATION REMOVED =========================
// View Document button now uses direct event listener in selectFile() function
// This matches the pattern used in file repository module

// ========================= FILE PREVIEW MODAL FUNCTIONS =========================
function openFilePreview(doc) {
  const modal = document.getElementById("previewModal");
  const modalTitle = document.getElementById("previewModalTitle");
  const modalContent = document.getElementById("previewModalContent");

  if (!modal || !modalTitle || !modalContent) return;

  modalTitle.textContent = doc.fileName;
  modalContent.innerHTML =
    '<p style="text-align: center; color: #666; padding: 40px;">Loading preview...</p>';
  modal.classList.add("active");

  setTimeout(() => {
    modalContent.innerHTML = generateFilePreview(doc);
  }, 100);
}

function closeFilePreview() {
  const modal = document.getElementById("previewModal");
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => {
      const modalContent = document.getElementById("previewModalContent");
      if (modalContent) {
        modalContent.innerHTML = "<p>Loading preview...</p>";
      }
    }, 300);
  }
}

// Attach close button event
document
  .getElementById("closePreviewModal")
  ?.addEventListener("click", closeFilePreview);

// Close on overlay click
document.getElementById("previewModal")?.addEventListener("click", (e) => {
  if (e.target.id === "previewModal") closeFilePreview();
});

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("previewModal");
    if (modal?.classList.contains("active")) {
      closeFilePreview();
    }
  }
});

// Make function globally accessible for onclick
window.closeFilePreview = closeFilePreview;

// ========================= SIGNATURE PREVIEW MODAL =========================
function showSignaturePreviewModal() {
  const modal = document.getElementById("signaturePreviewModal");
  const previewImg = document.getElementById("previewSigImg");

  if (modal && previewImg && currentSignatureData) {
    previewImg.src = currentSignatureData;
    modal.classList.add("active");
  }
}

function closeSignaturePreviewModal() {
  const modal = document.getElementById("signaturePreviewModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

function editSignatureAgain() {
  closeSignaturePreviewModal();
  // User stays on signature panel to edit
}

function proceedToPlacement() {
  closeSignaturePreviewModal();
  showSignaturePlacementModal();
}

window.closeSignaturePreviewModal = closeSignaturePreviewModal;
window.editSignatureAgain = editSignatureAgain;
window.proceedToPlacement = proceedToPlacement;

// ========================= SIGNATURE PLACEMENT MODAL =========================
async function showSignaturePlacementModal() {
  const modal = document.getElementById("signaturePlacementModal");
  const docPreview = document.getElementById("placementDocContent");
  const draggableSignature = document.getElementById("draggableSignature");
  const signatureImage = document.getElementById("signatureImage");

  if (
    !modal ||
    !docPreview ||
    !draggableSignature ||
    !signatureImage ||
    !selectedFileId
  )
    return;

  selectedDocument = documentsData.find((f) => f.id === selectedFileId);
  if (!selectedDocument) return;

  // Show modal
  modal.classList.add("active");

  // Load document preview
  docPreview.innerHTML = "<p>Loading document...</p>";
  const previewHTML = await generateFilePreview(selectedDocument);
  docPreview.innerHTML = previewHTML;

  // Clear any previous event listeners by cloning the element
  const newDraggable = draggableSignature.cloneNode(true);
  draggableSignature.parentNode.replaceChild(newDraggable, draggableSignature);
  const newSignatureImage = newDraggable.querySelector("#signatureImage");

  // Set up signature image with loading check
  return new Promise((resolve) => {
    newSignatureImage.onload = () => {
      // Image loaded successfully
      newDraggable.style.display = "block";
      newDraggable.style.left = "50px";
      newDraggable.style.top = "50px";
      newDraggable.style.width = "200px";
      newDraggable.style.height = "80px";
      newDraggable.style.border = "2px dashed #0461CE";
      newDraggable.style.padding = "5px";
      newDraggable.style.background = "rgba(255, 255, 255, 0.95)";
      newDraggable.style.boxShadow = "0 4px 12px rgba(4, 97, 206, 0.3)";
      newDraggable.style.borderRadius = "4px";
      newDraggable.style.zIndex = "1000";

      // Make signature draggable and resizable
      makeDraggable(newDraggable);
      makeResizable(newDraggable);
      resolve();
    };

    newSignatureImage.onerror = () => {
      showToast("Failed to load signature image", "error");
      resolve();
    };

    // Set the source to trigger loading
    newSignatureImage.src = currentSignatureData;
  });
}

function makeDraggable(element) {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  let isDragging = false;

  element.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;

    // Don't drag if clicking on resize handles
    if (e.target.classList.contains("resize-handle")) {
      return;
    }

    e.preventDefault();
    isDragging = true;

    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;

    // Add visual feedback - keep it fully visible while dragging
    element.style.opacity = "1";
    element.style.cursor = "grabbing";
    element.style.boxShadow = "0 6px 16px rgba(4, 97, 206, 0.5)";
  }

  function elementDrag(e) {
    if (!isDragging) return;

    e = e || window.event;
    e.preventDefault();

    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    // Set the element's new position
    element.style.top = element.offsetTop - pos2 + "px";
    element.style.left = element.offsetLeft - pos1 + "px";

    // Store placement coordinates
    signaturePlacement = {
      x: element.offsetLeft,
      y: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    };
  }

  function closeDragElement() {
    // Stop moving when mouse button is released
    isDragging = false;
    document.onmouseup = null;
    document.onmousemove = null;
    element.style.opacity = "1";
    element.style.cursor = "move";
    element.style.boxShadow = "0 4px 12px rgba(4, 97, 206, 0.3)";
  }
}

function makeResizable(element) {
  const handles = element.querySelectorAll(".resize-handle");

  let isResizing = false;
  let currentHandle = null;
  let startX, startY, startWidth, startHeight, startLeft, startTop;

  handles.forEach((handle) => {
    handle.addEventListener("mousedown", initResize);
  });

  function initResize(e) {
    e.preventDefault();
    e.stopPropagation();

    isResizing = true;
    currentHandle = e.target;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(element.style.width, 10);
    startHeight = parseInt(element.style.height, 10);
    startLeft = element.offsetLeft;
    startTop = element.offsetTop;

    document.addEventListener("mousemove", doResize);
    document.addEventListener("mouseup", stopResize);

    // Keep fully visible while resizing
    element.style.opacity = "1";
    element.style.boxShadow = "0 6px 16px rgba(4, 97, 206, 0.5)";
  }

  function doResize(e) {
    if (!isResizing) return;

    const direction = currentHandle.getAttribute("data-direction");
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    // Calculate new dimensions based on handle direction
    if (direction.includes("e")) {
      newWidth = startWidth + dx;
    }
    if (direction.includes("w")) {
      newWidth = startWidth - dx;
      newLeft = startLeft + dx;
    }
    if (direction.includes("s")) {
      newHeight = startHeight + dy;
    }
    if (direction.includes("n")) {
      newHeight = startHeight - dy;
      newTop = startTop + dy;
    }

    // Enforce minimum size
    if (newWidth >= 50 && newHeight >= 30) {
      element.style.width = newWidth + "px";
      element.style.height = newHeight + "px";

      if (direction.includes("w")) {
        element.style.left = newLeft + "px";
      }
      if (direction.includes("n")) {
        element.style.top = newTop + "px";
      }

      // Store updated placement
      signaturePlacement = {
        x: element.offsetLeft,
        y: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight,
      };
    }
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener("mousemove", doResize);
    document.removeEventListener("mouseup", stopResize);
    element.style.opacity = "1";
    element.style.boxShadow = "0 4px 12px rgba(4, 97, 206, 0.3)";
  }
}

function closePlacementModal() {
  const modal = document.getElementById("signaturePlacementModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

function moveSignatureAgain() {
  // User can continue dragging - just close the confirmation if needed
  showToast("Continue dragging the signature to reposition it", "info", 2000);
}

async function confirmSignaturePlacement() {
  if (!selectedFileId || !currentSignatureData) {
    showToast("Missing signature data", "error");
    return;
  }

  // Prepare signature data
  const signaturePayload = {
    fileId: selectedFileId,
    signatureData: currentSignatureData,
    x: signaturePlacement.x,
    y: signaturePlacement.y,
    method: signatureMethod,
  };

  try {
    const response = await fetch("../api/signatures/save.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signaturePayload),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      // Show success message
      showToast("Signature saved successfully!", "success");

      // Check if all signatures were embedded into the file
      if (result.signaturesEmbedded) {
        showToast(
          "✓ All signatures collected! Document is now fully signed and ready for download.",
          "success",
          6000,
        );
      } else if (result.embeddedMessage) {
        showToast(result.embeddedMessage, "info", 4000);
      }

      // Close all modals
      closePlacementModal();
      closeSignaturePanel();

      // Refresh documents list
      await fetchSignatoryDocuments();

      // Reset state
      currentSignatureData = null;
      selectedFileId = null;
      signaturePlacement = { x: 0, y: 0 };
    } else {
      showToast(
        "Failed to save signature: " + (result.error || "Unknown error"),
        "error",
      );
    }
  } catch (error) {
    console.error("Error saving signature:", error);
    showToast("Error saving signature. Please try again.", "error");
  }
}

window.closePlacementModal = closePlacementModal;
window.moveSignatureAgain = moveSignatureAgain;
window.confirmSignaturePlacement = confirmSignaturePlacement;

// ========================= INITIAL LOAD =========================
fetchSignatoryDocuments();
