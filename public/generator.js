// generator.js (fully fixed with all improvements)

// ---------------- Globals & DOM refs ----------------
const chatMessages = document.getElementById("chat-messages");
const editorTabs = document.getElementById("editor-tabs");
const chatBox = document.getElementById("chat-box");
const chatSend = document.getElementById("chat-send");
let downloadBtn = document.getElementById("download-btn"); // let for re-assignment

let currentJobId = null;
let openFiles = {};
let activeFile = null;
let editor;
let pollTimeout = null; // for cleanup

// ---------- UI helpers ----------
function escapeHTML(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function addBubble(role, html) {
  const div = document.createElement("div");
  div.className = `message ${role === "AI" ? "ai" : "user"}`;
  div.innerHTML = html;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function addTextBubble(role, text) {
  return addBubble(role, `<div>${escapeHTML(text)}</div>`);
}

function setSendingState(sending) {
  chatSend.disabled = sending;
  chatSend.textContent = sending ? "..." : "Send";
}

// ---------- Typing effect into Monaco ----------
async function typeIntoEditor(model, content) {
  if (!model || !content) return;
  
  model.setValue("");
  const len = content.length;
  
  // Skip animation for large files
  if (len > 8000) {
    model.setValue(content);
    return;
  }
  
  // Type animation
  for (let i = 0; i <= len; i++) {
    model.setValue(content.slice(0, i));
    await new Promise(r => setTimeout(r, 5));
  }
}

// ---------- Poll Job ----------
async function pollJob(id) {
  // Clear any existing timeout
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }

  try {
    const resp = await fetch(`/status/${id}`);
    if (!resp.ok) throw new Error("Status fetch failed");
    const job = await resp.json();

    if (job.progress && Array.isArray(job.progress)) {
      chatMessages.innerHTML = "";
      job.progress.forEach(msg => addTextBubble("AI", msg));
    }

    if (job.status === "done") {
      addTextBubble("AI", "✅ Project ready!");
      
      try {
        const tree = await loadFileTree(id);
        if (tree && Object.keys(tree).length > 0) {
          loadPreview(id);
          onJobDoneShowDownload(id);
        } else {
          addTextBubble("AI", "⚠️ No files were generated.");
        }
      } catch (e) {
        console.error("Failed to load file tree:", e);
        addTextBubble("AI", "⚠️ Could not load project files.");
      }
    } else if (job.status === "error") {
      addTextBubble("AI", "⚠️ Generation failed. Please try again.");
    } else {
      // Continue polling
      pollTimeout = setTimeout(() => pollJob(id), 1200);
    }
  } catch (e) {
    console.error("Poll error:", e);
    addTextBubble("AI", "⚠️ Could not check job status.");
  }
}

// ---------- Chat send ----------
chatSend.addEventListener("click", onSend);
chatBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    onSend();
  }
});

async function onSend() {
  const text = chatBox.value.trim();
  if (!text) return;

  addTextBubble("user", text);
  chatBox.value = "";

  let typingNode = null;

  try {
    setSendingState(true);

    if (!currentJobId) {
      // YAHAN FIX KARO - FormData properly use karo
      const formData = new FormData();
      formData.append("prompt", text);

      console.log("Starting new project...");
      const resp = await fetch("/api/generate", {
        method: "POST",
        body: formData  // ✅ FormData send karo (no headers needed)
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("Server error:", errorText);
        throw new Error(`Server error: ${resp.status}`);
      }

      const data = await resp.json();

      if (!data.jobId) {
        addTextBubble("AI", "⚠️ Failed to start new project.");
        return;
      }

      currentJobId = data.jobId;
      console.log("Job created:", currentJobId);

      // Reset editor state
      openFiles = {};
      editorTabs.innerHTML = "";
      if (editor) editor.setValue("// Building your project...");

      addTextBubble("AI", "🤖 Building your project...");
      pollJob(currentJobId);
      return;
    }

    // Chat with existing project
    typingNode = addBubble("AI", `<span style="opacity:.8">🤖 typing…</span>`);

    const resp = await fetch(`/api/chat/${currentJobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    if (!resp.ok) {
      throw new Error(`Server error: ${resp.status}`);
    }

    let data;
    try {
      data = await resp.json();
    } catch (err) {
      typingNode.innerHTML = escapeHTML("⚠️ Server returned invalid response.");
      return;
    }

    const replyText = typeof data.reply === "string" ? data.reply : "";
    typingNode.innerHTML = replyText
      ? `<div>${escapeHTML(replyText)}</div>`
      : `<div>⏳ The model didn't respond. Try again.</div>`;

    if (data.filesUpdated) {
      await loadFileTree(currentJobId);
      loadPreview(currentJobId);

      if (Array.isArray(data.newFiles) && data.newFiles.length) {
        for (const filePath of data.newFiles) {
          try {
            const respFile = await fetch(
              `/api/jobs/${currentJobId}/file?path=${encodeURIComponent(filePath)}`
            );

            if (!respFile.ok) continue;

            const content = await respFile.text();

            // Check if file already open
            let model = openFiles[filePath];
            if (!model) {
              model = monaco.editor.createModel("", undefined, monaco.Uri.file(filePath));
              openFiles[filePath] = model;

              // Check if tab already exists
              const existingTab = [...editorTabs.children].find(
                t => t.dataset.path === filePath
              );

              if (!existingTab) {
                const tab = document.createElement("span");
                tab.textContent = filePath.split("/").pop();
                tab.title = filePath;
                tab.dataset.path = filePath;
                tab.addEventListener("click", () => setActiveTab(filePath));
                editorTabs.appendChild(tab);
              }
            }

            setActiveTab(filePath);
            await typeIntoEditor(model, content);
          } catch (e) {
            console.error(`Failed to open ${filePath}:`, e);
            addTextBubble("AI", `⚠️ Failed to open ${filePath}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("Send error:", err);
    if (typingNode) {
      typingNode.innerHTML = `<div>${escapeHTML(`⚠️ Error: ${err.message}`)}</div>`;
    } else {
      addTextBubble("AI", `⚠️ Error: ${err.message}`);
    }
  } finally {
    setSendingState(false);
  }
}

// ---------- File Tree ----------
async function loadFileTree(jobId) {
  try {
    const resp = await fetch(`/api/jobs/${jobId}/files`);
    if (!resp.ok) throw new Error("Could not fetch file tree");
    
    const tree = await resp.json();
    
    if (!tree || typeof tree !== "object") {
      throw new Error("Invalid file tree data");
    }
    
    const fileTreeEl = document.getElementById("file-tree");
    fileTreeEl.innerHTML = "";
    renderTree(tree, "", fileTreeEl, jobId);
    return tree;
  } catch (e) {
    console.error("File tree error:", e);
    addTextBubble("AI", "⚠️ Could not load file tree.");
    return {};
  }
}

function renderTree(tree, prefix, parent, jobId) {
  if (!tree || typeof tree !== "object") return;
  
  for (const [name, value] of Object.entries(tree)) {
    const li = document.createElement("li");
    li.textContent = name;
    li.dataset.path = prefix + name;
    parent.appendChild(li);

    if (value === "file") {
      li.addEventListener("click", () => {
        document.querySelectorAll("#file-tree li").forEach(n => n.classList.remove("active"));
        li.classList.add("active");
        openFile(jobId, li.dataset.path);
      });
    } else {
      const ul = document.createElement("ul");
      li.appendChild(ul);
      renderTree(value, prefix + name + "/", ul, jobId);
    }
  }
}

// ---------- Open file in Monaco ----------
async function openFile(jobId, filePath) {
  try {
    // If already open, just switch to it
    if (openFiles[filePath]) {
      setActiveTab(filePath);
      return;
    }

    const resp = await fetch(
      `/api/jobs/${jobId}/file?path=${encodeURIComponent(filePath)}`
    );
    
    if (!resp.ok) throw new Error("File fetch failed");
    const content = await resp.text();

    const model = monaco.editor.createModel("", undefined, monaco.Uri.file(filePath));
    openFiles[filePath] = model;

    // Check if tab already exists
    const existingTab = [...editorTabs.children].find(t => t.dataset.path === filePath);
    
    if (!existingTab) {
      const tab = document.createElement("span");
      tab.textContent = filePath.split("/").pop();
      tab.title = filePath;
      tab.dataset.path = filePath;
      tab.addEventListener("click", () => setActiveTab(filePath));
      editorTabs.appendChild(tab);
    }

    setActiveTab(filePath);
    await typeIntoEditor(model, content);
  } catch (e) {
    console.error(`Could not open file ${filePath}:`, e);
    addTextBubble("AI", `⚠️ Could not open file: ${filePath}`);
  }
}

function setActiveTab(filePath) {
  activeFile = filePath;
  
  // Check if model exists before setting
  if (openFiles[filePath] && editor) {
    editor.setModel(openFiles[filePath]);
  }
  
  // Update tab UI
  [...editorTabs.children].forEach(tab =>
    tab.classList.toggle("active", tab.dataset.path === filePath)
  );
}

// ---------- Preview ----------
function loadPreview(jobId) {
  const iframe = document.getElementById("preview-frame");
  if (iframe) {
    iframe.src = `/api/jobs/${jobId}/preview?ts=${Date.now()}`;
  }
}

// ---------- Tabs ----------
const codeTab = document.getElementById("code-tab");
const previewTab = document.getElementById("preview-tab");

if (codeTab) {
  codeTab.addEventListener("click", () => {
    const editorArea = document.getElementById("editor-area");
    const previewArea = document.getElementById("preview-area");
    if (editorArea) editorArea.style.display = "flex";
    if (previewArea) previewArea.style.display = "none";
  });
}

if (previewTab) {
  previewTab.addEventListener("click", () => {
    const editorArea = document.getElementById("editor-area");
    const previewArea = document.getElementById("preview-area");
    if (editorArea) editorArea.style.display = "none";
    if (previewArea) previewArea.style.display = "flex";
  });
}

// ------------------ DOWNLOAD ZIP SUPPORT ------------------

// Flatten nested tree object into array of file paths
function flattenTree(treeObj, prefix = "") {
  const files = [];
  if (!treeObj || typeof treeObj !== "object") return files;
  
  for (const [name, value] of Object.entries(treeObj)) {
    if (value === "file") {
      files.push(prefix + name);
    } else {
      files.push(...flattenTree(value, prefix + name + "/"));
    }
  }
  return files;
}

// Show/enable the download button when job done
function onJobDoneShowDownload(jobId) {
  if (!downloadBtn) return;
  
  downloadBtn.style.display = "inline-block";
  downloadBtn.disabled = false;
  downloadBtn.textContent = "Download";
  
  // Remove old listener by cloning
  const newBtn = downloadBtn.cloneNode(true);
  downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
  downloadBtn = newBtn;
  
  // Add fresh listener
  downloadBtn.addEventListener("click", async () => {
    if (!currentJobId) {
      alert("No project to download.");
      return;
    }
    await downloadProjectZip(currentJobId);
  });
}

// Try server-side zip endpoint first; fallback to client-side zip via JSZip
async function downloadProjectZip(jobId) {
  if (!downloadBtn) return;
  
  // Check for saveAs function
  if (typeof saveAs !== "function") {
    alert("FileSaver.js library not loaded. Please refresh the page.");
    return;
  }
  
  downloadBtn.disabled = true;
  const originalText = downloadBtn.textContent || "Download";
  downloadBtn.textContent = "Preparing…";

  // Try server-side endpoint
  try {
    const resp = await fetch(`/api/jobs/${jobId}/download`, { method: "GET" });
    if (resp.ok) {
      const blob = await resp.blob();
      saveAs(blob, `${jobId}.zip`);
      downloadBtn.disabled = false;
      downloadBtn.textContent = originalText;
      return;
    }
  } catch (e) {
    console.warn("Server-side zip unavailable, using client-side fallback", e);
  }

  // Client-side fallback
  try {
    const respTree = await fetch(`/api/jobs/${jobId}/files`);
    if (!respTree.ok) throw new Error("Could not fetch file tree");
    
    const tree = await respTree.json();
    const paths = flattenTree(tree);

    if (!paths.length) throw new Error("No files found to download");

    // Check JSZip availability
    if (typeof JSZip !== "function") {
      throw new Error("JSZip library not loaded. Please refresh the page.");
    }

    const zip = new JSZip();
    let count = 0;
    const total = paths.length;

    for (const p of paths) {
      downloadBtn.textContent = `Preparing ${++count}/${total}…`;
      
      const fileResp = await fetch(`/api/jobs/${jobId}/file?path=${encodeURIComponent(p)}`);
      if (!fileResp.ok) {
        console.warn("Failed to fetch", p);
        continue;
      }
      
      const buffer = await fileResp.arrayBuffer();
      zip.file(p, buffer);
    }

    downloadBtn.textContent = "Zipping…";
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${jobId}.zip`);
    
  } catch (err) {
    console.error("Download ZIP failed:", err);
    alert("Download failed: " + (err.message || "unknown error"));
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = originalText;
  }
}

// ---------- Cleanup on page unload ----------
window.addEventListener("beforeunload", () => {
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  
  // Dispose all Monaco models
  Object.values(openFiles).forEach(model => {
    if (model && typeof model.dispose === "function") {
      model.dispose();
    }
  });
});

// ---------- Init ----------
const urlParams = new URLSearchParams(window.location.search);
currentJobId = urlParams.get("job");
if (currentJobId) {
  console.log("Resuming job:", currentJobId);
  pollJob(currentJobId);
}

// ---------- Monaco Editor ----------
require.config({
  paths: { "vs": "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs" }
});

require(["vs/editor/editor.main"], () => {
  console.log("Monaco Editor loaded");
  
  const editorContainer = document.getElementById("editor");
  if (!editorContainer) {
    console.error("Editor container not found!");
    return;
  }
  
  editor = monaco.editor.create(editorContainer, {
    value: "// Waiting for AI to generate files...",
    language: "javascript",
    theme: "vs-dark",
    automaticLayout: true,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontLigatures: false,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0,
    minimap: { enabled: true },
    smoothScrolling: true,
    tabSize: 2,
    insertSpaces: true,
    renderWhitespace: "boundary",
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
    padding: { top: 8, bottom: 8 }
  });
  
  console.log("Monaco Editor initialized");
});
