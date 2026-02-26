# Logout Modal Integration Guide

## Overview

A reusable, modern logout confirmation modal that follows the FlowDocs design pattern.

## Features

- Modern modal design with glass-morphism effect
- Smooth animations (fade in, slide up)
- Gradient red button for logout action
- Keyboard support (ESC to close)
- Click outside to close
- Fully responsive

## Files

- `/api/logout/logout-modal.css` - Modal styles
- `/api/logout/logout-modal.js` - Modal functionality

## How to Integrate into Any Module

### Step 1: Add CSS to your HTML file

```html
<head>
  <!-- Your existing stylesheets -->
  <link rel="stylesheet" href="../api/logout/logout-modal.css" />
</head>
```

### Step 2: Add Modal HTML (before closing `</body>` tag)

```html
  <!-- Logout Modal -->
  <div id="logoutModal" class="logout-modal">
    <div class="logout-modal-overlay"></div>
    <div class="logout-modal-content">
      <div class="logout-modal-header">
        <h3 class="logout-modal-title">
          <span class="material-symbols-rounded">logout</span>
          Logout Confirmation
        </h3>
        <button class="logout-modal-close">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
      <div class="logout-modal-body">
        <div class="logout-modal-icon">
          <span class="material-symbols-rounded">logout</span>
        </div>
        <div class="logout-modal-text">
          <h3>Are you sure you want to logout?</h3>
          <p>You will be redirected to the login page and will need to sign in again to access your account.</p>
        </div>
      </div>
      <div class="logout-modal-actions">
        <button id="btnLogoutCancel" class="logout-modal-btn logout-modal-btn-cancel">
          Cancel
        </button>
        <button id="btnLogoutConfirm" class="logout-modal-btn logout-modal-btn-logout">
          Logout
        </button>
      </div>
    </div>
  </div>

  <!-- Your scripts -->
  <script src="../api/logout/logout-modal.js"></script>
</body>
```

### Step 3: Add JavaScript

```html
<script src="../api/logout/logout-modal.js"></script>
```

That's it! The logout modal will automatically:

- Find all sidebar links with "Logout" label
- Open the modal when clicked
- Handle logout confirmation
- Redirect to login page on confirm

## Current Implementation

Currently implemented in all modules:

**Admin Modules:**

- ✅ Admin Dashboard (`/admin_dashboard/m_dashboard.html`)
- ✅ Admin User Management (`/admin_userManagement/m_userManagement.html`)
- ✅ Admin File Directory (`/admin_fileDirectory/m_fileDirectory.html`)
- ✅ Admin Messages (`/admin_messages/m_messages.html`)
- ✅ Admin File Repository (`/admin_fileRepository/m_fileRepository.html`)
- ✅ Admin E-Signature (`/admin_e-signature/m_signature.html`)
- ✅ Admin Profile (`/admin_profile/m_profile.html`)

**Employee Modules:**

- ✅ Employee Dashboard (`/employee_dashboard/e_dashboard.html`)
- ✅ Employee File Directory (`/employee_fileDirectory/e_fileDirectory.html`)
- ✅ Employee Messages (`/employee_messages/e_messages.html`)
- ✅ Employee File Repository (`/employee_fileRepository/e_fileRepository.html`)
- ✅ Employee E-Signature (`/employee_e-signature/e_e-signature.html`)
- ✅ Employee Profile (`/employee_profile/e_profile.html`)

## Notes

- Modal requires Material Symbols Rounded icons
- Modal automatically prevents body scroll when open
- ESC key closes the modal
- Clicking outside the modal closes it
- No additional JavaScript code needed in your module

## Customization

To customize the logout redirect URL, edit line 49 in `/api/logout/logout-modal.js`:

```javascript
window.location.href = "../login/login.php"; // Change this URL
```
