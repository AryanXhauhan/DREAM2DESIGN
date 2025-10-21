// generator.js (full updated - includes Download ZIP support)

// ---------------- Globals & DOM refs ----------------
const chatMessages = document.getElementById("chat-messages");
const editorTabs   = document.getElementById("editor-tabs");
const chatBox      = document.getElementById("chat-box");
const chatSend     = document.getElementById("chat-send");
const downloadBtn  = document.getElementById("download-btn");

let currentJobId = null;
let openFiles    = {};
let activeFile   = null;
let editor;

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
  return div; // so we can update it (e.g., replace typing…)
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
  model.setValue("");
  const len = content.length;
  if (len > 8000) {
    model.setValue(content);
    return;
  }
  for (let i = 0; i <= len; i++) {
    model.setValue(content.slice(0, i));
    await new Promise(r => setTimeout(r, 6));
  }
}

// ---------- Poll Job ----------
async function pollJob(id) {
  try {
    const resp = await fetch(`/status/${id}`);
    if (!resp.ok) throw new Error("Status fetch failed");
    const job = await resp.json();

    if (job.progress && Array.isArray(job.progress)) {
      // replace with status bubbles
      chatMessages.innerHTML = "";
      job.progress.forEach(msg => addTextBubble("AI", msg));
    }

    if (job.status === "done") {
      addTextBubble("AI", "✅ Project ready!");
      // Ensure file tree is loaded before enabling download
      try {
        await loadFileTree(id);
      } catch (e) {
        // ignore errors but continue
      }
      loadPreview(id);
      onJobDoneShowDownload(id);
    } else if (job.status !== "error") {
      setTimeout(() => pollJob(id), 1200);
    } else {
      addTextBubble("AI", "⚠️ Generation failed.");
    }
  } catch (e) {
    addTextBubble("AI", "⚠️ Could not poll job status.");
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

  try {
    setSendingState(true);

    if (!currentJobId) {
      // Start a new project
      const form = new FormData();
      form.append("prompt", text);

      const resp = await fetch("/api/generate", { method: "POST", body: form });
      const data = await resp.json();
      if (!data.jobId) {
        addTextBubble("AI", "⚠️ Failed to start new project.");
        return;
      }
      currentJobId = data.jobId;

      openFiles = {};
      editorTabs.innerHTML = "";
      if (editor) editor.setValue("// Building your project...");
      addTextBubble("AI", "🤖 Building a fresh project...");
      pollJob(currentJobId);
      return;
    }

    const typingNode = addBubble("AI", `<span style="opacity:.8">🤖 typing…</span>`);

    const resp = await fetch(`/api/chat/${currentJobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    let data;
    try {
      data = await resp.json();
    } catch (err) {
      typingNode.innerHTML = escapeHTML("⚠️ Server returned invalid JSON.");
      return;
    }

    const replyText = typeof data.reply === "string" ? data.reply : "";
    typingNode.innerHTML = replyText
      ? `<div>${escapeHTML(replyText)}</div>`
      : `<div>⏳ The model didn’t send a message. Try again.</div>`;

    if (data.filesUpdated) {
      await loadFileTree(currentJobId);
      loadPreview(currentJobId);

      if (Array.isArray(data.newFiles) && data.newFiles.length) {
        for (const filePath of data.newFiles) {
          try {
            const respFile = await fetch(
              `/api/jobs/${currentJobId}/file?path=${encodeURIComponent(filePath)}`
            );
            const content = await respFile.text();

            let model = openFiles[filePath];
            if (!model) {
              model = monaco.editor.createModel("", undefined, monaco.Uri.file(filePath));
              openFiles[filePath] = model;

              const tab = document.createElement("span");
              tab.textContent = filePath.split("/").pop();
              tab.title = filePath;
              tab.dataset.path = filePath;
              tab.addEventListener("click", () => setActiveTab(filePath));
              editorTabs.appendChild(tab);
            }

            setActiveTab(filePath);
            await typeIntoEditor(model, content);
          } catch {
            addTextBubble("AI", `⚠️ Failed to open ${filePath}`);
          }
        }
      }
    }
  } catch (err) {
    addTextBubble("AI", `⚠️ Error: ${err.message}`);
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
    const fileTreeEl = document.getElementById("file-tree");
    fileTreeEl.innerHTML = "";
    renderTree(tree, "", fileTreeEl, jobId);
    return tree;
  } catch {
    addTextBubble("AI", "⚠️ Could not load file tree.");
    return {};
  }
}

function renderTree(tree, prefix, parent, jobId) {
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

    const tab = document.createElement("span");
    tab.textContent = filePath.split("/").pop();
    tab.title = filePath;
    tab.dataset.path = filePath;
    tab.addEventListener("click", () => setActiveTab(filePath));
    editorTabs.appendChild(tab);

    setActiveTab(filePath);
    await typeIntoEditor(model, content);
  } catch (e) {
    addTextBubble("AI", `⚠️ Could not open file: ${filePath}`);
  }
}

function setActiveTab(filePath) {
  activeFile = filePath;
  if (openFiles[filePath] && editor) editor.setModel(openFiles[filePath]);
  [...editorTabs.children].forEach(tab =>
    tab.classList.toggle("active", tab.dataset.path === filePath)
  );
}

// ---------- Preview ----------
function loadPreview(jobId) {
  const iframe = document.getElementById("preview-frame");
  iframe.src = `/api/jobs/${jobId}/preview?ts=${Date.now()}`;
}

// ---------- Tabs ----------
document.getElementById("code-tab").addEventListener("click", () => {
  document.getElementById("editor-area").style.display = "flex";
  document.getElementById("preview-area").style.display = "none";
});
document.getElementById("preview-tab").addEventListener("click", () => {
  document.getElementById("editor-area").style.display = "none";
  document.getElementById("preview-area").style.display = "flex";
});

// ------------------ DOWNLOAD ZIP SUPPORT ------------------

// Flatten nested tree object into array of file paths
function flattenTree(treeObj, prefix = "") {
  const files = [];
  for (const [name, value] of Object.entries(treeObj || {})) {
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
  // attach click handler if not already
  if (!downloadBtn._attached) {
    downloadBtn.addEventListener("click", async () => {
      if (!currentJobId) {
        alert("No job active to download.");
        return;
      }
      await downloadProjectZip(currentJobId);
    });
    downloadBtn._attached = true;
  }
}

// Try server-side zip endpoint first; fallback to client-side zip via JSZip
async function downloadProjectZip(jobId) {
  if (!downloadBtn) return;
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
    console.warn("server-side zip endpoint unavailable", e);
  }

  // Client-side fallback
  try {
    const respTree = await fetch(`/api/jobs/${jobId}/files`);
    if (!respTree.ok) throw new Error("Could not fetch file tree");
    const tree = await respTree.json();
    const paths = flattenTree(tree);

    if (!paths.length) throw new Error("No files found to download");

    const JSZipLib = window.JSZip;
    if (!JSZipLib) throw new Error("JSZip not loaded");

    const zip = new JSZipLib();
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

// ---------- Init ----------
const urlParams = new URLSearchParams(window.location.search);
currentJobId = urlParams.get("job");
if (currentJobId) pollJob(currentJobId);

// ---------- Monaco ----------
require.config({
  paths: { "vs": "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs" }
});
require(["vs/editor/editor.main"], () => {
  editor = monaco.editor.create(document.getElementById("editor"), {
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
});
