require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage() });

// 🔑 OpenRouter Key
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_KEY) {
  console.error("❌ CRITICAL: Missing OPENROUTER_API_KEY in .env");
  process.exit(1);
} else {
  console.log("✅ OpenRouter API Key loaded");
}

/* =========================
   CONSTANTS & HELPERS
   ========================= */
const MANIFEST = ".d2d-manifest.json";
const PREVIEW_HTML = "preview.html";

const jobs = {};
const JOBS_DIR = path.join(__dirname, "jobs");
if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR);

function jobDirOf(jobId) {
  return path.join(JOBS_DIR, jobId);
}

function readJSONSafe(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {}
  return fallback;
}

function listAllFilesRecursive(root) {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else out.push(rel);
    }
  })(root);
  return out;
}

function writeFileSafe(fullPath, content) {
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function buildTree(dir) {
  const result = {};
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    result[item] = fs.statSync(full).isDirectory() ? buildTree(full) : "file";
  }
  return result;
}

/* ---- OpenRouter - Qwen3 Coder with Fallback to DeepSeek ---- */
async function fetchWithTimeout(url, options = {}, timeoutMs = 90000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Call Qwen3 Coder with fallback to DeepSeek
async function callQwenCoder(messages, { temperature = 0.3, max_tokens = 12000, retries = 3 }) {
  let lastErr = null;

  // Try Qwen3 Coder first
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`🔄 Qwen3 Coder - Attempt ${attempt + 1}/${retries}`);

      const resp = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Dream2Design"
        },
        body: JSON.stringify({
          model: "qwen/qwen3-coder:free",
          messages,
          temperature,
          max_tokens
        })
      }, 90000);

      console.log(`📡 Status: ${resp.status}`);

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        const errMsg = data?.error?.message || `HTTP ${resp.status}`;
        console.error(`❌ API Error: ${errMsg}`);
        throw new Error(errMsg);
      }

      const choice = data?.choices?.[0]?.message || {};
      const content = (choice.content || "").trim();

      if (!content) {
        console.warn("⚠️ Empty response from Qwen3 Coder");
        throw new Error("Empty response from model");
      }

      console.log(`✅ Received ${content.length} characters`);
      return { ok: true, content, raw: data };

    } catch (e) {
      lastErr = e;
      console.error(`❌ Attempt ${attempt + 1} failed: ${e.message}`);

      if (attempt < retries - 1) {
        const delay = 2000 * (attempt + 1);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // Fallback to DeepSeek Chat
  console.log("🔄 Falling back to DeepSeek Chat...");
  try {
    const resp = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Dream2Design"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages,
        temperature,
        max_tokens
      })
    }, 90000);

    console.log(`📡 DeepSeek Status: ${resp.status}`);

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const errMsg = data?.error?.message || `HTTP ${resp.status}`;
      console.error(`❌ DeepSeek API Error: ${errMsg}`);
      throw new Error(errMsg);
    }

    const choice = data?.choices?.[0]?.message || {};
    const content = (choice.content || "").trim();

    if (!content) {
      console.warn("⚠️ Empty response from DeepSeek");
      throw new Error("Empty response from fallback model");
    }

    console.log(`✅ DeepSeek Received ${content.length} characters`);
    return { ok: true, content, raw: data };

  } catch (e) {
    console.error(`❌ DeepSeek fallback failed: ${e.message}`);
    return { ok: false, error: lastErr?.message || "Both models failed" };
  }
}

/* ---- Parsing helpers ---- */
function extractJsonBlock(text) {
  if (!text) return null;
  let t = String(text).trim();

  // Remove code fences

  t = t.replace(/```/g, "").trim();

  // Try direct parse
  try { return JSON.parse(t); } catch (_) {}

  // Find JSON block
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;

  const attempts = [
    m[0],
    m[0].replace(/\r/g, ""),
    m[0].replace(/\\n/g, "\n"),
  ];

  for (const s of attempts) {
    try { return JSON.parse(s); } catch (_) {}
  }
  return null;
}

function normalizeAIJson(text) {
  const parsed = extractJsonBlock(text);
  if (!parsed || typeof parsed !== "object") return null;
  if (!parsed.files) return null;

  // Convert array format to object
  if (Array.isArray(parsed.files)) {
    const mapped = {};
    for (const f of parsed.files) {
      if (f && f.filename && typeof f.content === "string") {
        mapped[f.filename] = f.content;
      }
    }
    parsed.files = mapped;
  }

  if (typeof parsed.files !== "object") return null;

  return {
    files: parsed.files,
    preview: typeof parsed.preview === "string" ? parsed.preview : undefined,
  };
}

function pickBestTarget(currentList, incomingName) {
  const ext = path.extname(incomingName).toLowerCase();
  if (currentList.includes(incomingName)) return incomingName;

  const sameExt = currentList.filter(f => path.extname(f).toLowerCase() === ext);
  if (sameExt.length === 0) return null;

  const rank = (f) => {
    const base = f.split("/").pop().toLowerCase();
    const scores = {
      ".html": ["index.html", "app.html", "main.html"],
      ".css":  ["styles.css", "style.css", "main.css"],
      ".js":   ["app.js", "main.js", "index.js"],
    };
    const list = scores[ext] || [];
    const idx = list.indexOf(base);
    return idx >= 0 ? idx : 9;
  };

  sameExt.sort((a,b) => rank(a) - rank(b));
  return sameExt[0];
}

/* =========================
   ROUTES
   ========================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "front.html"));
});

// GENERATE
app.post("/api/generate", upload.array("files", 5), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: "⚠️ Prompt required" });
    }

    console.log("\n" + "=".repeat(70));
    console.log("🚀 NEW GENERATION - Qwen3 Coder");
    console.log("Prompt:", prompt.slice(0, 120));
    console.log("=".repeat(70));

    const jobId = crypto.randomBytes(8).toString("hex");
    jobs[jobId] = { id: jobId, status: "queued", progress: ["🎯 Job created"], result: null };

    const dir = jobDirOf(jobId);
    fs.mkdirSync(dir, { recursive: true });

    res.json({ jobId });

    // Background processing
    (async () => {
      try {
        jobs[jobId].status = "processing";
        jobs[jobId].progress.push("🤖 Calling AI...");

        const systemPrompt = `You are an expert full-stack web developer specializing in modern, production-ready web applications. Generate exceptional, high-quality code that exceeds expectations.

STRICT REQUIREMENTS:
1. Return ONLY valid JSON - no explanations, no markdown
2. Use this exact structure:
{
  "files": {
    "frontend/index.html": "complete HTML code",
    "frontend/styles.css": "complete CSS code",
    "frontend/app.js": "complete JavaScript code"
  },
  "preview": "standalone HTML file with inline CSS/JS for preview"
}

CODE QUALITY STANDARDS:
3. HTML: Semantic HTML5, proper accessibility (ARIA labels, alt texts), clean structure
4. CSS: Modern CSS3 with advanced features:
   - CSS Grid and Flexbox for layouts
   - CSS custom properties (variables) for theming
   - Smooth animations and transitions
   - Responsive design with mobile-first approach
   - Beautiful gradients, shadows, and modern typography
   - Dark mode support where appropriate
5. JavaScript: Modern ES6+ features:
   - Async/await, arrow functions, destructuring
   - Modular, well-commented code with error handling
   - Local storage for data persistence
   - Event delegation and efficient DOM manipulation
   - Input validation and user feedback
   - Advanced features like drag-drop, search, filtering where relevant

DESIGN REQUIREMENTS:
6. Visually stunning with professional UI/UX
7. Fully responsive across all devices
8. Interactive elements with hover/focus states
9. Loading states and smooth transitions
10. Error handling with user-friendly messages
11. The preview must be a perfect, standalone HTML file

Make the application feature-rich, polished, and production-ready with exceptional attention to detail.`;

        const userPrompt = `Create a professional web application for: "${prompt}"

Requirements:
- Complete, working code in all files
- Modern, clean UI design
- Responsive layout
- Professional styling
- All functionality implemented

Return ONLY the JSON object.`;

        const result = await callQwenCoder(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          { temperature: 0.3, max_tokens: 12000 }
        );

        if (!result.ok) {
          throw new Error(result.error || "AI generation failed");
        }

        console.log("📝 Response received:", result.content.length, "chars");
        console.log("📝 Raw response (first 1000 chars):", result.content.slice(0, 1000));

        const parsed = normalizeAIJson(result.content);
        
        if (!parsed || !parsed.files || Object.keys(parsed.files).length === 0) {
          console.error("❌ Invalid JSON from AI");
          console.log("Raw (first 500 chars):", result.content.slice(0, 500));
          throw new Error("AI returned invalid JSON format");
        }

        const fileNames = Object.keys(parsed.files);
        console.log("✅ Parsed successfully");
        console.log("📂 Files:", fileNames.join(", "));

        // Save files
        for (const [filename, content] of Object.entries(parsed.files)) {
          console.log(`💾 ${filename} (${content.length} chars)`);
          writeFileSafe(path.join(dir, filename), content);
        }

        if (parsed.preview) {
          console.log(`💾 preview.html (${parsed.preview.length} chars)`);
          writeFileSafe(path.join(dir, PREVIEW_HTML), parsed.preview);
        }

        // Manifest
        const allFiles = listAllFilesRecursive(dir).filter(
          f => f !== MANIFEST && f !== PREVIEW_HTML
        );
        writeFileSafe(path.join(dir, MANIFEST), JSON.stringify({ files: allFiles }, null, 2));

        jobs[jobId].result = parsed;
        jobs[jobId].status = "done";
        jobs[jobId].progress.push(`✅ Generated ${allFiles.length} files successfully!`);
        
        console.log(`✅ JOB COMPLETED: ${jobId}`);
        console.log("=".repeat(70) + "\n");
        
      } catch (err) {
        console.error("\n❌ ERROR:", err.message);
        console.error("=".repeat(70) + "\n");
        jobs[jobId].status = "error";
        jobs[jobId].result = { error: err.message };
        jobs[jobId].progress.push(`❌ Error: ${err.message}`);
      }
    })();
    
  } catch (err) {
    console.error("❌ Route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// STATUS
app.get("/status/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// FILE TREE
app.get("/api/jobs/:jobId/files", (req, res) => {
  const dir = jobDirOf(req.params.jobId);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: "Not found" });
  res.json(buildTree(dir));
});

// FILE READ
app.get("/api/jobs/:jobId/file", (req, res) => {
  const dir = jobDirOf(req.params.jobId);
  const filePath = path.join(dir, req.query.path);
  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
  res.type("text/plain").send(fs.readFileSync(filePath, "utf8"));
});

// FILE SAVE
app.put("/api/jobs/:jobId/file", (req, res) => {
  const dir = jobDirOf(req.params.jobId);
  const filePath = path.join(dir, req.body.path);
  writeFileSafe(filePath, req.body.content);
  res.json({ success: true });
});

// PREVIEW
app.get("/api/jobs/:jobId/preview", (req, res) => {
  const dir = jobDirOf(req.params.jobId);
  const previewFile = path.join(dir, PREVIEW_HTML);
  if (fs.existsSync(previewFile)) return res.sendFile(previewFile);
  
  const fallback = listAllFilesRecursive(dir).find(f => f.includes("index.html"));
  if (fallback) return res.sendFile(path.join(dir, fallback));
  
  res.status(404).send("⚠️ No preview found");
});

// CHAT
app.post("/api/chat/:jobId", async (req, res) => {
  const { message } = req.body;
  const jobId = req.params.jobId;

  if (!jobs[jobId]) return res.status(404).json({ error: "Job not found" });

  console.log(`\n💬 CHAT - Job ${jobId}: ${message.slice(0, 80)}`);

  const dir = jobDirOf(jobId);
  const manifest = readJSONSafe(path.join(dir, MANIFEST), { files: [] });
  const existingFiles = manifest.files.filter(f => f !== MANIFEST && f !== PREVIEW_HTML);

  jobs[jobId].messages = jobs[jobId].messages || [];
  jobs[jobId].messages.push({ role: "user", content: message });

  const systemRules = `You are a code editor AI for Dream2Design.

EXISTING FILES:
${existingFiles.map(f => `- ${f}`).join("\n")}

RULES:
1. UPDATE existing files only. Do NOT create new files.
2. For code changes, return JSON:
   { "files": { "path": "complete file content" }, "preview": "updated preview if needed" }
3. For questions, return plain text (no JSON).
4. Always provide complete file content, not snippets.`;

  const messages = [
    { role: "system", content: systemRules },
    ...jobs[jobId].messages
  ];

  try {
    const result = await callQwenCoder(messages, { temperature: 0.3, max_tokens: 12000 });

    const reply = result.ok ? result.content : "⚠️ AI unavailable. Please try again.";
    jobs[jobId].messages.push({ role: "assistant", content: reply });

    console.log(`🤖 Reply: ${reply.length} chars`);

    const parsed = normalizeAIJson(reply);
    let filesUpdated = false;
    let newFiles = [];
    let chatReply = reply;

    if (parsed && parsed.files && Object.keys(parsed.files).length > 0) {
      const updated = [];
      const currentList = listAllFilesRecursive(dir).filter(
        f => f !== MANIFEST && f !== PREVIEW_HTML
      );

      for (const [incomingName, content] of Object.entries(parsed.files)) {
        let target = currentList.includes(incomingName)
          ? incomingName
          : pickBestTarget(currentList, incomingName);

        if (!target) {
          const ext = path.extname(incomingName).toLowerCase();
          const hasExt = currentList.some(f => path.extname(f).toLowerCase() === ext);
          if (!hasExt) target = incomingName;
          else continue;
        }

        console.log(`💾 Updating: ${target}`);
        writeFileSafe(path.join(dir, target), content);
        if (!updated.includes(target)) updated.push(target);
      }

      if (parsed.preview) {
        writeFileSafe(path.join(dir, PREVIEW_HTML), parsed.preview);
      }

      if (updated.length > 0) {
        filesUpdated = true;
        newFiles = updated;
        chatReply = `✅ Updated: ${updated.join(", ")}`;

        const refreshed = listAllFilesRecursive(dir).filter(
          f => f !== MANIFEST && f !== PREVIEW_HTML
        );
        writeFileSafe(path.join(dir, MANIFEST), JSON.stringify({ files: refreshed }, null, 2));
        console.log(`✅ Updated ${updated.length} file(s)`);
      }
    }

    res.json({ reply: chatReply, filesUpdated, newFiles });
    
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

// SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 Dream2Design - Powered by Qwen3 Coder");
  console.log("=".repeat(70));
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`📁 Jobs: ${JOBS_DIR}`);
  console.log(`🎯 Model: Qwen3 Coder (free) - 262K context`);
  console.log(`🔑 API: ✅ Loaded`);
  console.log("=".repeat(70) + "\n");
});
