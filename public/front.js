// front.js (robust: confirm on disabled interactions + preserved logic)
// Full updated file — improved avatar handling with probe + fallback + initials badge

// ---------------------- AUTH / UI GATING ----------------------
function isLoggedIn() {
  return localStorage.getItem("loggedIn") === "true";
}

/**
 * Create an initials badge element for header avatar fallback.
 * @param {string} username
 * @returns HTMLElement
 */
function createInitialsBadge(username) {
  const initials = document.createElement("div");
  initials.className = "header-avatar-initials";
  const char = (username && username.trim().length ? username.trim()[0] : "U").toUpperCase();
  initials.textContent = char;
  // Basic inline styles (you can move to CSS)
  initials.style.cssText = [
    "width:36px",
    "height:36px",
    "border-radius:50%",
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "background:#2b2f36",
    "color:#fff",
    "font-weight:700",
    "font-size:14px",
    "user-select:none"
  ].join(";");
  return initials;
}

/**
 * Ensures header-avatar element exists and is an <img>.
 * If a non-img element exists, it will be replaced with an <img>.
 * If none exists, an <img> will be created and inserted as the first child of #user-info.
 * Returns the resulting <img> element (or null if user-info missing).
 */
function ensureHeaderAvatarElem(username) {
  const userInfo = document.getElementById("user-info");
  if (!userInfo) return null;

  let headerAvatar = document.getElementById("header-avatar");

  if (!headerAvatar) {
    // create an <img> and insert before the first child (so it aligns with username)
    const img = document.createElement("img");
    img.id = "header-avatar";
    img.alt = username || "User";
    img.width = 36;
    img.height = 36;
    img.style.cssText = "width:36px;height:36px;border-radius:50%;object-fit:cover;display:inline-block;";
    userInfo.insertBefore(img, userInfo.firstChild);
    headerAvatar = img;
  } else if (headerAvatar.tagName && headerAvatar.tagName.toLowerCase() !== "img") {
    // replace with <img>
    const img = document.createElement("img");
    img.id = "header-avatar";
    img.alt = username || "User";
    img.width = 36;
    img.height = 36;
    img.style.cssText = headerAvatar.style.cssText || "width:36px;height:36px;border-radius:50%;object-fit:cover;display:inline-block;";
    headerAvatar.parentNode.replaceChild(img, headerAvatar);
    headerAvatar = img;
  }

  return headerAvatar;
}

/**
 * Show user in header with robust avatar handling:
 * - probes the avatarURL first to detect load success
 * - uses default avatar if probe fails
 * - converts to initials badge if defaults also fail
 */
function showUserInHeader() {
  const username = localStorage.getItem("username") || "User";
  const avatarURL = (localStorage.getItem("avatarURL") || "assets/default-avatar.png").trim();
  const userInfo = document.getElementById("user-info");
  const headerUsername = document.getElementById("header-username");
  const signInBtn = document.getElementById("signin-btn");

  if (!userInfo || !headerUsername) {
    console.warn("showUserInHeader: missing #user-info or #header-username");
    return;
  }

  // ensure an <img id="header-avatar"> exists
  const headerAvatar = ensureHeaderAvatarElem(username);
  if (!headerAvatar) {
    console.warn("showUserInHeader: failed to ensure header avatar element.");
  }

  // Update username + show userInfo
  headerUsername.textContent = username;
  userInfo.style.display = "flex";
  if (signInBtn) signInBtn.style.display = "none";

  // If there's no avatar element (rare), bail after showing username
  if (!headerAvatar) return;

  // Remove any existing fallback initials that might be in place previously
  const existingInitials = userInfo.querySelector(".header-avatar-initials");
  if (existingInitials) existingInitials.remove();

  // Helper: set initials badge in place of image
  function setInitialsFallback() {
    try {
      // If headerAvatar still exists as <img>, replace it with initials badge
      const initials = createInitialsBadge(username);
      if (headerAvatar.parentNode) headerAvatar.parentNode.replaceChild(initials, headerAvatar);
    } catch (e) {
      console.error("setInitialsFallback error:", e);
    }
  }

  // Probe given avatar URL (cache-busted) before assigning to the visible <img>.
  // This prevents the browser broken-image icon flash.
  try {
    if (!avatarURL) {
      // no URL -> show initials
      setInitialsFallback();
      return;
    }

    const probe = new Image();
    const probeUrl = avatarURL + (avatarURL.includes("?") ? "&" : "?") + "v=" + Date.now();

    probe.onload = () => {
      // Image loaded successfully — set src on visible img
      try {
        headerAvatar.src = probeUrl;
        headerAvatar.alt = username;
        headerAvatar.style.display = "";
      } catch (e) {
        console.warn("Failed to set headerAvatar src:", e);
        setInitialsFallback();
      }
    };

    probe.onerror = () => {
      console.warn("Avatar probe failed for", avatarURL);
      // Try default local asset next
      const defaultUrl = "assets/default-avatar.png";
      const probeDefault = new Image();
      probeDefault.onload = () => {
        try {
          headerAvatar.src = defaultUrl;
          headerAvatar.alt = username;
          headerAvatar.style.display = "";
        } catch (e) {
          console.warn("Failed to set default avatar:", e);
          setInitialsFallback();
        }
      };
      probeDefault.onerror = () => {
        // default asset failed too -> initials fallback
        setInitialsFallback();
      };
      probeDefault.src = defaultUrl + "?v=" + Date.now();
    };

    // Kick off probe
    probe.src = probeUrl;

    // Also add defensive onerror to the visible img: if later the image fails to load,
    // swap to initials (this covers runtime broken links).
    headerAvatar.onerror = () => {
      console.warn("Visible header-avatar image failed to load, swapping to initials.");
      setInitialsFallback();
    };

  } catch (err) {
    console.error("showUserInHeader error:", err);
    setInitialsFallback();
  }
}

function hideUserInHeader() {
  const userInfo = document.getElementById("user-info");
  const signInBtn = document.getElementById("signin-btn");
  if (userInfo) userInfo.style.display = "none";
  if (signInBtn) signInBtn.style.display = "inline-block";
}

function setInputEnabled(enabled) {
  const messageBox = document.getElementById("message");
  if (!messageBox) return;
  if (enabled) {
    messageBox.removeAttribute("disabled");
    messageBox.style.cursor = "text";
  } else {
    // Use boolean disabled attribute properly
    messageBox.setAttribute("disabled", "true");
    messageBox.style.cursor = "not-allowed";
  }
}

// ---------------------- MAIN: attach robust confirm/alert handlers ----------------------
function attachRobustUnauthHandlers() {
  const dropZone = document.getElementById("drop-zone");
  const messageBox = document.getElementById("message");
  const sendBtn = document.getElementById("send-btn");

  function askToLoginConfirm() {
    // confirm gives user quick choice to go to login
    try {
      const go = confirm("Please login first — Go to Login?");
      if (go) window.location.href = "login.html";
    } catch (e) {
      // fallback
      alert("Please login first");
    }
  }

  if (dropZone) {
    // capturing listener - runs early in event chain
    dropZone.addEventListener("click", (e) => {
      if (!isLoggedIn()) {
        e.stopImmediatePropagation?.();
        e.preventDefault?.();
        askToLoginConfirm();
      }
    }, { capture: true });
  }

  if (messageBox) {
    // some browsers don't dispatch clicks on disabled elements, so listen to parent too
    messageBox.addEventListener("click", (e) => {
      if (!isLoggedIn()) {
        e.preventDefault?.();
        askToLoginConfirm();
      }
    }, { capture: true });

    // defensive focus handler: blur + alert/confirm
    messageBox.addEventListener("focus", (e) => {
      if (!isLoggedIn()) {
        messageBox.blur();
        askToLoginConfirm();
      }
    }, { capture: true });
  }

  if (sendBtn) {
    // attach a pre-handler in capture phase to intercept unauth clicks immediately
    sendBtn.addEventListener("click", (e) => {
      if (!isLoggedIn()) {
        e.preventDefault?.();
        e.stopImmediatePropagation?.();
        askToLoginConfirm();
        return;
      }
      // else let the normal send flow continue (the original send click listener is preserved below)
    }, { capture: true });
  }
}

// Attach logout behavior
function attachLogout() {
  const logoutBtn = document.getElementById("header-logout");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    try {
      localStorage.removeItem("loggedIn");
      localStorage.removeItem("username");
      localStorage.removeItem("avatarURL");
    } catch (e) {
      console.warn("localStorage clear failed", e);
    }

    // Reset UI immediately
    setInputEnabled(false);
    hideUserInHeader();

    // Redirect to front.html (reload)
    window.location.href = "front.html";
  });
}

// Initialize page auth/UI state and attach handlers
document.addEventListener("DOMContentLoaded", () => {
  if (isLoggedIn()) {
    setInputEnabled(true);
    showUserInHeader();
  } else {
    setInputEnabled(false);
    hideUserInHeader();
  }

  attachRobustUnauthHandlers();
  attachLogout();
});

// ---------------------- FILE UPLOAD + SEND LOGIC (preserved) ----------------------
const fileInput = document.getElementById("file-input");
const filePreview = document.getElementById("file-preview");
const sendBtn = document.getElementById("send-btn");
const messageBox = document.getElementById("message");
const errorMsg = document.getElementById("error-message");

let uploadedFiles = [];

function showError(msg) {
  if (!errorMsg) return;
  errorMsg.textContent = msg;
  errorMsg.classList.add("show");
  setTimeout(() => errorMsg.classList.remove("show"), 2500);
  setTimeout(() => { errorMsg.textContent = ""; }, 3200);
}

if (fileInput) {
  fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
    fileInput.value = "";
    checkScroll();
  });
}

function handleFiles(files) {
  if (!files) return;
  if (uploadedFiles.length + files.length > 5) {
    showError("🚫 Limit reached! Only 5 images allowed.");
    return;
  }
  Array.from(files).forEach(file => {
    if (uploadedFiles.length >= 5) {
      showError("🚫 Limit reached! Only 5 images allowed.");
      return;
    }
    uploadedFiles.push(file);

    const fileItem = document.createElement("div");
    fileItem.classList.add("file-item");
    if (uploadedFiles.length === 1) fileItem.classList.add("large");

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    fileItem.appendChild(img);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.classList.add("close-btn");
    closeBtn.addEventListener("click", () => {
      if (filePreview && fileItem.parentNode === filePreview) filePreview.removeChild(fileItem);
      uploadedFiles = uploadedFiles.filter(f => f !== file);
      updatePreviewLayout();
      checkScroll();
    });
    fileItem.appendChild(closeBtn);
    filePreview && filePreview.appendChild(fileItem);
  });
  updatePreviewLayout();
  checkScroll();
}

function updatePreviewLayout() {
  const items = filePreview ? filePreview.querySelectorAll(".file-item") : [];
  items.forEach((item, index) => {
    item.classList.remove("large");
    if (index === 0) item.classList.add("large");
  });
}

// SEND button's main handler (non-capture) - preserved original behavior
if (sendBtn) {
  sendBtn.addEventListener("click", async () => {
    if (!isLoggedIn()) {
      // As a safety fallback in case capture didn't intercept
      const go = confirm("Please login first — Go to Login?");
      if (go) window.location.href = "login.html";
      return;
    }

    if (!messageBox.value && uploadedFiles.length === 0) {
      showError("⚠️ Please enter a message or upload files.");
      return;
    }

    try {
      sendBtn.disabled = true;
      sendBtn.innerHTML = "⏳";

      const form = new FormData();
      form.append("prompt", messageBox.value || "");
      uploadedFiles.forEach((file) => form.append("files", file));

      const resp = await fetch("/api/generate", { method: "POST", body: form });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown" }));
        showError("API error: " + (err.error || resp.statusText));
        return;
      }

      const data = await resp.json();
      const jobId = data.jobId;

      window.location.href = `/generator.html?job=${jobId}`;
    } catch (err) {
      console.error(err);
      showError("⚠️ Network/API error");
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = `<img src="assets/send.gif" alt="Send">`;
    }
  });
}

// auto-grow textarea
if (messageBox) {
  messageBox.addEventListener("input", () => {
    messageBox.style.height = "auto";
    const newHeight = Math.min(messageBox.scrollHeight, 140);
    messageBox.style.height = newHeight + "px";
    checkScroll();
  });
}

// ---------------------- SCROLL HELPERS ----------------------
function checkScroll() {
  const body = document.body;
  const html = document.documentElement;
  const docHeight = Math.max(
    body.scrollHeight, body.offsetHeight,
    html.clientHeight, html.scrollHeight, html.offsetHeight
  );
  document.body.style.overflowY = docHeight > window.innerHeight ? "auto" : "hidden";
}

const observer = new MutationObserver(checkScroll);
observer.observe(document.body, { childList: true, subtree: true, attributes: true });

window.addEventListener("resize", checkScroll);
window.addEventListener("load", checkScroll);
