/* ========================= SIDEBAR TOGGLE FUNCTIONALITY ========================= */
const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");

sidebarToggler.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});

/* ========================= LIVE DATE & TIME UPDATE ========================= */
function updateDateTime() {
  const now = new Date();

  // Format: September 12, Thursday | 13:30
  const options = {
    month: "long",
    day: "numeric",
    weekday: "long",
  };

  const dateString = now.toLocaleDateString("en-US", options);
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const formatted = `${dateString} | ${timeString}`;
  document.getElementById("datetimeDisplay").textContent = formatted;
}

// Update immediately and then every second
updateDateTime();
setInterval(updateDateTime, 1000);

/* ========================= TOAST NOTIFICATION FUNCTION ========================= */
function showToast(message, type = "success", duration = 3000) {
  const toast = document.getElementById("toast");
  const toastIcon = document.getElementById("toastIcon");
  const toastMessage = document.getElementById("toastMessage");

  // Set icon based on type
  const icons = {
    success: "check_circle",
    error: "error",
    warning: "warning",
    info: "info",
  };

  toastIcon.textContent = icons[type] || "info";
  toastMessage.textContent = message;

  // Remove all type classes and add the current type
  toast.classList.remove("success", "error", "warning", "info");
  toast.classList.add("show", type);

  // Auto hide after duration
  setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

/* ========================= STATE MANAGEMENT ========================= */
let conversations = [];
let messages = {};
let activities = [];
let currentUserId = null;
/* ========================= RENDER FUNCTIONS ========================= */

// Fetch and render conversations
async function fetchConversations() {
  try {
    const [meResponse, conversationsResponse] = await Promise.all([
      fetch("../api/users/me.php"),
      fetch("../api/messages/conversations.php"),
    ]);

    if (meResponse.ok) {
      const me = await meResponse.json();
      currentUserId = me.id;
      console.log("Current user:", currentUserId);
    }

    if (!conversationsResponse.ok) {
      const errorData = await conversationsResponse
        .json()
        .catch(() => ({ error: "Unknown error" }));
      console.error(
        "Conversations API Error:",
        conversationsResponse.status,
        errorData,
      );
      throw new Error(
        `Failed to fetch conversations: ${conversationsResponse.status}`,
      );
    }

    conversations = await conversationsResponse.json();
    console.log("Conversations loaded:", conversations);
    renderConversations(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    document.getElementById("conversationsList").innerHTML =
      '<div class="placeholder-message">Failed to load conversations</div>';
  }
}

function renderConversations(users) {
  const conversationsList = document.getElementById("conversationsList");
  conversationsList.innerHTML = "";

  if (!users || users.length === 0) {
    conversationsList.innerHTML =
      '<div class="placeholder-message">No conversations available</div>';
    return;
  }

  users.forEach((user, index) => {
    const conversationItem = document.createElement("div");
    conversationItem.className = `conversation-item ${
      index === 0 ? "active" : ""
    }`;
    conversationItem.dataset.userId = user.id;
    conversationItem.dataset.department = user.department || "Employee";

    conversationItem.innerHTML = `
      <div class="conversation-avatar">${(user.name || user.username).substring(0, 2).toUpperCase()}</div>
      <div class="conversation-info">
        <div class="conversation-header">
          <span class="conversation-name">${user.name || user.username}</span>
          <span class="conversation-time">${user.lastMessageTime || "Now"}</span>
        </div>
        <span class="conversation-department ${(user.department || "employee").toLowerCase()}">${
          user.department || "Employee"
        }</span>
        <div class="conversation-preview">${user.lastMessage || "No messages yet"}</div>
      </div>
    `;

    conversationItem.addEventListener("click", () =>
      selectConversation(user.id),
    );
    conversationsList.appendChild(conversationItem);
  });

  // Load first conversation by default
  if (users.length > 0) {
    selectConversation(users[0].id);
  }
}

// Select and display conversation
function selectConversation(userId) {
  // Update active state
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.classList.remove("active");
    if (Number(item.dataset.userId) === Number(userId)) {
      item.classList.add("active");
    }
  });

  // Get user data
  const user = conversations.find((u) => Number(u.id) === Number(userId));
  if (!user) return;

  // Update chat header
  const userInitials = (user.name || user.username)
    .substring(0, 2)
    .toUpperCase();
  document.getElementById("chatAvatar").innerHTML =
    `<span>${userInitials}</span>`;
  document.getElementById("chatUserName").textContent =
    user.name || user.username;

  const departmentElement = document.getElementById("chatUserDepartment");
  departmentElement.textContent = user.department || "Employee";
  departmentElement.className = `chat-user-department ${(user.department || "employee").toLowerCase()}`;

  // Load messages
  fetchMessages(userId);
}

// Fetch messages for selected user
async function fetchMessages(userId) {
  try {
    // Fetch both messages and document notifications for this specific user
    const [messagesResponse, notificationsResponse] = await Promise.all([
      fetch(`../api/messages/chat.php?userId=${userId}`),
      fetch(`../api/notifications/chat_notifications.php?userId=${userId}`),
    ]);

    if (!messagesResponse.ok) {
      const errorData = await messagesResponse
        .json()
        .catch(() => ({ error: "Unknown error" }));
      console.error("API Error:", messagesResponse.status, errorData);
      throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
    }

    const messagesList = await messagesResponse.json();
    const notificationsList = notificationsResponse.ok
      ? await notificationsResponse.json()
      : [];

    // Combine messages and notifications
    const combined = [...messagesList, ...notificationsList];

    // Sort by timestamp to ensure proper chronological order
    combined.sort((a, b) => {
      // Try fullTimestamp first, then timestamp, then default to current time
      let timeA = a.fullTimestamp || a.timestamp;
      let timeB = b.fullTimestamp || b.timestamp;

      // If timestamp is in HH:MM format, prepend today's date
      if (timeA && timeA.length === 5 && timeA.includes(":")) {
        const today = new Date().toISOString().split("T")[0];
        timeA = `${today} ${timeA}:00`;
      }
      if (timeB && timeB.length === 5 && timeB.includes(":")) {
        const today = new Date().toISOString().split("T")[0];
        timeB = `${today} ${timeB}:00`;
      }

      const dateA = timeA ? new Date(timeA).getTime() : 0;
      const dateB = timeB ? new Date(timeB).getTime() : 0;

      return dateA - dateB;
    });

    messages[userId] = combined;
    console.log(
      "Messages and notifications loaded for user",
      userId,
      ":",
      messages[userId],
    );
    renderMessages(messages[userId] || []);
  } catch (error) {
    console.error("Error fetching messages:", error);
    renderMessages([]);
  }
}

function renderMessages(messageList) {
  const chatMessages = document.getElementById("chatMessages");
  chatMessages.innerHTML = "";

  if (!messageList || messageList.length === 0) {
    chatMessages.innerHTML =
      '<div class="placeholder-message">No messages yet</div>';
    return;
  }

  // Add "Today" divider
  const divider = document.createElement("div");
  divider.className = "message-divider";
  divider.innerHTML = "<span>Today</span>";
  chatMessages.appendChild(divider);

  // Render messages
  messageList.forEach((message) => {
    if (message.type === "notification") {
      // Render notification as sent message bubble with status badge
      const messageBubble = document.createElement("div");
      messageBubble.className = "message-bubble notification-bubble";
      messageBubble.dataset.messageId = message.messageId;

      // Determine status badge
      let badgeClass, badgeText;
      if (message.status === "approved") {
        badgeClass = "badge-approved";
        badgeText = "Approved";
      } else if (message.status === "declined") {
        badgeClass = "badge-declined";
        badgeText = "Declined";
      } else if (message.status === "returned") {
        badgeClass = "badge-returned";
        badgeText = "Returned";
      }

      messageBubble.innerHTML = `
        <div class="message-sender">Notification</div>
        <div class="message-text">
          <span class="status-badge ${badgeClass}">${badgeText}</span>
          ${message.text || message.message}
        </div>
        <div class="message-timestamp">${message.timestamp}</div>
      `;

      chatMessages.appendChild(messageBubble);
    } else {
      // Render regular message bubble
      const messageBubble = document.createElement("div");
      messageBubble.className = `message-bubble ${message.type}`;
      messageBubble.dataset.messageId = message.messageId;

      messageBubble.innerHTML = `
        <div class="message-sender">${message.sender}</div>
        <div class="message-text">${message.text}</div>
        <div class="message-timestamp">${message.timestamp}</div>
      `;

      chatMessages.appendChild(messageBubble);
    }
  });

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fetch and render recent activities
async function fetchActivities() {
  try {
    const response = await fetch("../api/documents/pending.php");
    if (!response.ok) throw new Error("Failed to fetch activities");
    activities = await response.json();
    renderActivities(activities);
  } catch (error) {
    console.error("Error fetching activities:", error);
    renderActivities([]);
  }
}

function renderActivities(activitiesList = []) {
  const container = document.getElementById("activitiesList");
  if (!container) return;

  container.innerHTML = "";

  if (!activitiesList || activitiesList.length === 0) {
    container.innerHTML =
      '<div class="placeholder-message">No recent activities</div>';
    return;
  }

  activitiesList.forEach((activity) => {
    const activityItem = document.createElement("div");
    activityItem.className = `activity-item ${activity.status || "pending"}`;
    activityItem.dataset.activityId = activity.id;

    // Get icon based on file type
    let icon = "description";
    const fileType = (activity.fileType || "").toLowerCase();
    if (fileType.includes("pdf")) icon = "picture_as_pdf";
    if (fileType.includes("xlsx") || fileType.includes("sheet"))
      icon = "table_chart";

    activityItem.innerHTML = `
      <div class="activity-header">
        <div class="file-icon ${fileType}">
          <span class="material-symbols-rounded">${icon}</span>
        </div>
        <div class="activity-file-info">
          <div class="activity-file-name">${activity.fileName || "Unknown"}</div>
          <div class="activity-file-size">${activity.fileSize || "N/A"}</div>
        </div>
      </div>
      <div class="activity-footer">
        <span class="activity-status ${activity.status || "pending"}">${
          (activity.status || "pending").charAt(0).toUpperCase() +
          (activity.status || "pending").slice(1)
        }</span>
        <span class="activity-date">${activity.date || "Today"}</span>
      </div>
    `;

    container.appendChild(activityItem);
  });
}

/* ========================= MESSAGE INPUT HANDLING ========================= */

const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const attachButton = document.querySelector(".attach-button");

// Send message on button click
sendButton.addEventListener("click", sendMessage);

// Send message on Enter key
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Attach file button handler
if (attachButton) {
  attachButton.addEventListener("click", () => {
    console.log("File attachment feature - ready for backend integration");
    alert("File attachment feature will be available soon");
  });
}

function sendMessage() {
  const messageText = messageInput.value.trim();

  if (messageText === "") return;

  // Get active conversation
  const activeConversation = document.querySelector(
    ".conversation-item.active",
  );

  if (!activeConversation) {
    alert("Please select a conversation first");
    return;
  }

  const userId = parseInt(activeConversation.dataset.userId);
  const department = activeConversation.dataset.department;

  // Send message to backend
  fetch("../api/messages/index.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipientId: userId,
      message: messageText,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Message sent successfully:", data);
      // Refresh messages to show the new one
      fetchMessages(userId);
      messageInput.value = "";
    })
    .catch((error) => {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    });
}

/* ========================= ANNOUNCEMENT HANDLING ========================= */

const announcementText = document.getElementById("announcementText");
const announcementButton = document.getElementById("announcementButton");

announcementButton.addEventListener("click", makeAnnouncement);

function makeAnnouncement() {
  const announcement = announcementText.value.trim();

  if (announcement === "") {
    showToast("Please write an announcement first", "warning");
    return;
  }

  if (announcement.length > 500) {
    showToast("Announcement must be 500 characters or less", "warning");
    return;
  }

  // Send announcement to backend
  fetch("../api/announcements/index.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: announcement,
    }),
  })
    .then((response) => {
      console.log("Announcement response status:", response.status);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      console.log("Announcement sent successfully:", data);
      announcementText.value = "";
      showToast("Announcement sent successfully!", "success");
      // Refresh announcement history
      fetchAnnouncementHistory();
    })
    .catch((error) => {
      console.error("Error sending announcement:", error);
      showToast("Failed to send announcement: " + error.message, "error");
    });
}

/* ========================= ANNOUNCEMENT HISTORY ========================= */
async function fetchAnnouncementHistory() {
  try {
    const response = await fetch("../api/announcements/index.php?history=true");
    console.log("Announcement history response status:", response.status);

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      console.error(
        "Announcement history API Error:",
        response.status,
        errorData,
      );
      throw new Error(
        `Failed to fetch announcement history: ${response.status}`,
      );
    }

    const history = await response.json();
    console.log("Announcement history loaded:", history);
    renderAnnouncementHistory(history);
  } catch (error) {
    console.error("Error fetching announcement history:", error);
    renderAnnouncementHistory([]);
  }
}

function renderAnnouncementHistory(history) {
  const historyList = document.getElementById("announcementHistoryList");

  if (!history || history.length === 0) {
    historyList.innerHTML = '<p class="no-history">No announcements yet</p>';
    return;
  }

  historyList.innerHTML = "";

  history.forEach((announcement) => {
    const historyItem = document.createElement("div");
    historyItem.className = "history-item";

    historyItem.innerHTML = `
      <div class="history-header">
        <span class="history-date">${announcement.date}</span>
      </div>
      <div class="history-message">${announcement.message}</div>
    `;

    historyList.appendChild(historyItem);
  });
}

/* ========================= SEARCH FUNCTIONALITY ========================= */

const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const conversationItems = document.querySelectorAll(".conversation-item");

  conversationItems.forEach((item) => {
    const name = item
      .querySelector(".conversation-name")
      .textContent.toLowerCase();
    const department = item.dataset.department.toLowerCase();
    const preview = item
      .querySelector(".conversation-preview")
      .textContent.toLowerCase();

    if (
      name.includes(searchTerm) ||
      department.includes(searchTerm) ||
      preview.includes(searchTerm)
    ) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
});

/* ========================= DEPARTMENT FILTER FUNCTIONALITY ========================= */

const filterButtons = document.querySelectorAll(".filter-btn");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    // Update active state
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    // Get selected department
    const selectedDepartment = button.dataset.department;
    const conversationItems = document.querySelectorAll(".conversation-item");

    // Filter conversations
    conversationItems.forEach((item) => {
      const itemDepartment = item.dataset.department.toLowerCase();

      if (
        selectedDepartment === "all" ||
        itemDepartment === selectedDepartment
      ) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });

    // Clear search input when filtering
    searchInput.value = "";
  });
});

/* ========================= INITIALIZATION ========================= */

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  fetchConversations();
  fetchActivities();
  fetchAnnouncementHistory();
});

/* ========================= NOTES FOR BACKEND INTEGRATION ========================= */

/*
  To integrate with backend:
  
  1. Replace mockUsers with:
     fetch('/api/conversations')
       .then(res => res.json())
       .then(users => renderConversations(users));
  
  2. Replace mockMessages with:
     fetch(`/api/messages/${userId}`)
       .then(res => res.json())
       .then(messages => renderMessages(messages));
  
  3. Replace mockActivities with:
     fetch('/api/activities')
       .then(res => res.json())
       .then(activities => renderActivities(activities));
  
  4. Send messages:
     fetch('/api/messages', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ 
         userId: activeUserId, 
         message: messageText,
         department: userDepartment 
       })
     });
  
  5. Valid departments (STRICT): 'Sales', 'HR', 'Accounting'
     - Always validate department on backend
     - Reject any other department values
*/
