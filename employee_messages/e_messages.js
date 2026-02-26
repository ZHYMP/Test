/* ========================= SIDEBAR TOGGLE FUNCTIONALITY ========================= */
const sidebar = document.querySelector(".sidebar");
const sidebarToggler = document.querySelector(".sidebar-toggler");

sidebarToggler.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
});

/* ========================= LIVE DATE & TIME UPDATE ========================= */
function updateDateTime() {
  const now = new Date();

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

updateDateTime();
setInterval(updateDateTime, 1000);

/* ========================= STATE MANAGEMENT ========================= */
let conversations = [];
let messages = {};
let announcements = [];
let activeConversationId = null;
let currentUserId = null;
let activeUserRole = null; // Track the role of the user we're chatting with

/* ========================= RENDER CONVERSATIONS ========================= */
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
      '<div class="placeholder-message">No users available</div>';
    return;
  }

  users.forEach((user, index) => {
    const conversationItem = document.createElement("div");
    conversationItem.className = `conversation-item ${
      index === 0 ? "active" : ""
    }`;
    conversationItem.dataset.userId = user.id;
    conversationItem.dataset.department =
      user.department || user.role || "Employee";

    conversationItem.innerHTML = `
      <div class="conversation-avatar">${(user.name || user.username).substring(0, 2).toUpperCase()}</div>
      <div class="conversation-info">
        <div class="conversation-header">
          <span class="conversation-name">${user.name || user.username}</span>
          <span class="conversation-time">${user.lastMessageTime || "Now"}</span>
        </div>
        <span class="conversation-department ${(user.department || user.role || "employee").toLowerCase()}">${
          user.department || user.role || "Employee"
        }</span>
        <p class="conversation-preview">${user.lastMessage || "No messages yet"}</p>
      </div>
    `;

    conversationItem.addEventListener("click", () =>
      loadConversation(user.id, user),
    );

    conversationsList.appendChild(conversationItem);
  });

  if (users.length > 0) {
    loadConversation(users[0].id, users[0]);
  }
}

/* ========================= LOAD CONVERSATION ========================= */
function loadConversation(userId, userInfo) {
  activeConversationId = userId;
  activeUserRole = userInfo.role; // Store the role of the user we're chatting with

  // Update active state
  document.querySelectorAll(".conversation-item").forEach((item) => {
    item.classList.remove("active");
    if (Number(item.dataset.userId) === Number(userId)) {
      item.classList.add("active");
    }
  });

  // Update chat header
  const userInitials = (userInfo.name || userInfo.username || "User")
    .substring(0, 2)
    .toUpperCase();
  document.getElementById("chatAvatar").innerHTML =
    `<span>${userInitials}</span>`;
  document.getElementById("chatUserName").textContent =
    userInfo.name || userInfo.username || "User";
  document.getElementById("chatUserDepartment").textContent =
    userInfo.department || userInfo.role || "Employee";
  document.getElementById("chatUserDepartment").className =
    `chat-user-department ${(userInfo.department || userInfo.role || "employee").toLowerCase()}`;

  // Render messages for this conversation
  fetchMessages(userId);
}

/* ========================= RENDER MESSAGES ========================= */
async function fetchMessages(userId) {
  try {
    // Only fetch notifications if chatting with admin
    const shouldFetchNotifications = activeUserRole === "admin";

    let messagesResponse, notificationsResponse;

    if (shouldFetchNotifications) {
      [messagesResponse, notificationsResponse] = await Promise.all([
        fetch(`../api/messages/employee_chat.php?userId=${userId}`),
        fetch("../api/notifications/document_notifications.php"),
      ]);
    } else {
      // Only fetch messages for employee-to-employee chat
      messagesResponse = await fetch(
        `../api/messages/employee_chat.php?userId=${userId}`,
      );
    }

    if (!messagesResponse.ok) {
      const errorData = await messagesResponse
        .json()
        .catch(() => ({ error: "Unknown error" }));
      console.error("API Error:", messagesResponse.status, errorData);
      throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
    }

    const messagesList = await messagesResponse.json();
    const notificationsList =
      shouldFetchNotifications &&
      notificationsResponse &&
      notificationsResponse.ok
        ? await notificationsResponse.json()
        : [];

    // Combine messages and document notifications (only if chatting with admin)
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

  if (!messageList || messageList.length === 0) {
    chatMessages.innerHTML =
      '<div class="placeholder-message">No messages yet</div>';
    return;
  }

  chatMessages.innerHTML = "";

  messageList.forEach((message) => {
    // Document notification (approved/declined/returned)
    if (message.type === "notification" && message.status) {
      const messageBubble = document.createElement("div");
      messageBubble.className = "message-bubble notification-bubble";

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
          ${message.text}
        </div>
        <div class="message-timestamp">${message.timestamp}</div>
      `;

      chatMessages.appendChild(messageBubble);
      return;
    }

    // Skip announcements - they have their own section
    if (message.type === "announcement") {
      return;
    }

    // Regular message bubble only
    const messageDiv = document.createElement("div");
    messageDiv.className = `message-bubble ${message.type}`;

    messageDiv.innerHTML = `
      <div class="message-sender">${message.sender}</div>
      <div class="message-text">${message.text}</div>
      <div class="message-timestamp">${message.timestamp}</div>
    `;

    chatMessages.appendChild(messageDiv);
  });

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ========================= RENDER ANNOUNCEMENTS ========================= */
async function fetchAnnouncements() {
  try {
    const response = await fetch("../api/announcements/index.php");
    console.log("Announcements response status:", response.status);

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      console.error("Announcements API Error:", response.status, errorData);
      throw new Error(`Failed to fetch announcements: ${response.status}`);
    }

    announcements = await response.json();
    console.log("Announcements loaded:", announcements);
    console.log("First announcement:", announcements[0]);
    renderAnnouncements();
  } catch (error) {
    console.error("Error fetching announcements:", error);
    renderAnnouncements();
  }
}

function renderAnnouncements() {
  const announcementsList = document.getElementById("announcementsList");

  if (!announcements || announcements.length === 0) {
    announcementsList.innerHTML =
      '<div class="placeholder-message">No announcements</div>';
    return;
  }

  announcementsList.innerHTML = "";

  announcements.forEach((announcement) => {
    const announcementItem = document.createElement("div");
    announcementItem.className = "announcement-item";
    announcementItem.dataset.announcementId = announcement.id;

    // Determine author - use author field or fallback to admin name from title
    const author = announcement.author || announcement.title || "Admin";

    announcementItem.innerHTML = `
      <div class="announcement-header">
        <div class="announcement-icon">
          <span class="material-symbols-rounded">campaign</span>
        </div>
        <div class="announcement-info">
          <div class="announcement-author">${author}</div>
          <div class="announcement-date">${announcement.date || "Today"}</div>
        </div>
      </div>
      <div class="announcement-message">${announcement.message || announcement.title}</div>
    `;

    announcementsList.appendChild(announcementItem);
  });
}

/* ========================= MESSAGE INPUT HANDLING ========================= */
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const attachButton = document.querySelector(".attach-button");

sendButton.addEventListener("click", sendMessage);

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

  if (messageText === "") {
    return;
  }

  if (!activeConversationId) {
    alert("Please select a conversation first");
    return;
  }

  console.log("Message sent:", messageText);

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
      console.log("Message sent:", data);
      // Refresh messages
      fetchMessages(userId);
      messageInput.value = "";
    })
    .catch((error) => {
      console.error("Error sending message:", error);
      alert("Failed to send message");
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
document.addEventListener("DOMContentLoaded", () => {
  fetchConversations();
  fetchAnnouncements();

  // Poll for new announcements every 10 seconds
  setInterval(() => {
    fetchAnnouncements();
  }, 10000);
});

/* ========================= NOTES FOR BACKEND INTEGRATION ========================= */

/*
  Employee-side integration notes:
  
  1. Conversations should only show Admin
  2. All announcements are created by Admin - employees can only view them
  3. Employees can only send messages to Admin, not to other employees
  
  API endpoints needed:
  - GET /api/employee/conversations - Returns admin conversation
  - GET /api/employee/messages - Returns messages with admin
  - GET /api/employee/announcements - Returns all announcements from admin
  - POST /api/employee/messages - Send message to admin
*/
