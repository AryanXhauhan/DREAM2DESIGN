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
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "6mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage() });

// 🔑 OpenRouter Key
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_KEY) {
  console.warn("⚠️ Missing OPENROUTER_API_KEY in .env");
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

// safe read JSON
function readJSONSafe(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {}
  return fallback;
}

// recursive file lister (relative paths)
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

// safe write with mkdir -p
function writeFileSafe(fullPath, content) {
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

// simple file tree for UI
function buildTree(dir) {
  const result = {};
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    result[item] = fs.statSync(full).isDirectory() ? buildTree(full) : "file";
  }
  return result;
}

/* ---- OpenRouter robust helpers ---- */
async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Try one model with retries; return {ok, content, raw, error}
async function callModelOnce(messages, { model, temperature = 0.3, max_tokens = 4000, retries = 3 }) {
  let lastErr = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Dream2Design"
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error?.message || `OpenRouter ${resp.status}`);
      }

      const choice = data?.choices?.[0]?.message || {};
      // DeepSeek R1 sometimes uses reasoning_content
      const content =
        (choice.content && String(choice.content).trim()) ||
        (choice.reasoning_content && String(choice.reasoning_content).trim()) ||
        "";

      if (content) {
        return { ok: true, content, raw: data };
      }
      lastErr = new Error("Empty content from model");
    } catch (e) {
      lastErr = e;
    }
    await new Promise(r => setTimeout(r, 600 * (attempt + 1))); // backoff
  }

  return { ok: false, error: lastErr?.message || "Unknown OpenRouter error" };
}

// Prefer R1, fallback to deepseek-chat if empty/failed
async function callOpenRouterRobust(messages, opts = {}) {
  const primary = await callModelOnce(messages, {
    model: "deepseek/deepseek-r1:free",
    ...opts
  });
  if (primary.ok) return primary;

  // fallback to chat model (more consistent plain text)
  const fallback = await callModelOnce(messages, {
    model: "deepseek/deepseek-chat",
    ...opts
  });
  if (fallback.ok) return fallback;

  // neither worked
  return { ok: false, error: fallback.error || primary.error || "Model failed" };
}

/* ---- Parsing helpers ---- */

// Extract a JSON object from mixed plain-text + fenced code
function extractJsonBlock(text) {
  if (!text) return null;
  let t = String(text).trim();

  // strip code fences
  t = t.replace(/```(?:json|html)?/gi, "```");
  t = t.replace(/```/g, "").trim();

  // quick exact parse
  try { return JSON.parse(t); } catch (_) {}

  // find a { ... } block (greedy)
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;

  const candidate = m[0];
  const attempts = [
    candidate,
    candidate.replace(/\r/g, ""),
    candidate.replace(/\\n/g, "\n"),
  ];

  for (const s of attempts) {
    try { return JSON.parse(s); } catch (_) {}
  }
  return null;
}

// Normalize AI JSON → { files: {path:content}, preview?: string }
function normalizeAIJson(text) {
  const parsed = extractJsonBlock(text);
  if (!parsed || typeof parsed !== "object") return null;

  if (!parsed.files) return null;

  // support both object and array formats
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

// Find best existing file to overwrite based on extension/name
function pickBestTarget(currentList, incomingName) {
  const ext = path.extname(incomingName).toLowerCase();

  // exact path present
  if (currentList.includes(incomingName)) return incomingName;

  const sameExt = currentList.filter(f => path.extname(f).toLowerCase() === ext);
  if (sameExt.length === 0) return null;

  const rank = (f) => {
    const base = f.split("/").pop().toLowerCase();
    const folderBonus = f.includes("frontend/") ? -0.5 : 0;
    const scores = {
      ".html": ["index.html", "app.html", "main.html"],
      ".css":  ["styles.css", "style.css", "main.css", "app.css"],
      ".js":   ["app.js", "main.js", "index.js"],
      ".tsx":  ["app.tsx", "main.tsx", "index.tsx"],
      ".ts":   ["main.ts", "index.ts", "app.ts"],
    };
    const list = scores[ext] || [];
    const idx = list.indexOf(base);
    return (idx >= 0 ? idx : 9) + folderBonus;
  };

  sameExt.sort((a,b)=>rank(a)-rank(b));
  return sameExt[0];
}

/* =========================
   ROUTES
   ========================= */

// ROOT
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

    const jobId = crypto.randomBytes(8).toString("hex");
    jobs[jobId] = { id: jobId, status: "queued", progress: ["Job created"], result: null };

    const dir = jobDirOf(jobId);
    fs.mkdirSync(dir, { recursive: true });

    res.json({ jobId }); // immediate response

    (async () => {
      try {
        jobs[jobId].status = "processing";
        jobs[jobId].progress.push("🤖 Calling DeepSeek...");

        const userPrompt = `
You are Dream2Design AI.
User request: "${prompt}"

IMPORTANT:
- Return ONLY valid JSON.
- Use the "files" object with keys as file paths and values as file content.
- Also return a "preview" field that is a full HTML string for live preview.

Example:
{
  "files": {
    "frontend/index.html": "<!DOCTYPE html> ...",
    "frontend/styles.css": "body { ... }",
    "frontend/app.js": "console.log('Hello')"
  },
  "preview": "<!DOCTYPE html> ... full preview HTML ..."
}`;

        // --- Robust OpenRouter call (R1 + fallback) ---
        const or = await callOpenRouterRobust(
          [
            { role: "system", content: "You are Dream2Design AI. Always return valid JSON only." },
            { role: "user", content: userPrompt }
          ],
          { temperature: 0.3, max_tokens: 4000 }
        );

        const raw = or.ok ? or.content : "{}";
        const parsed = normalizeAIJson(raw) || { files: { "frontend/index.html": raw }, preview: raw };

        // save files
        for (const [filename, content] of Object.entries(parsed.files || {})) {
          writeFileSafe(path.join(dir, filename), content);
        }

        if (parsed.preview) {
          writeFileSafe(path.join(dir, PREVIEW_HTML), parsed.preview);
        }

        // write manifest
        const allFiles = listAllFilesRecursive(dir).filter(f => f !== MANIFEST && f !== PREVIEW_HTML);
        writeFileSafe(path.join(dir, MANIFEST), JSON.stringify({ files: allFiles }, null, 2));

        jobs[jobId].result = parsed;
        jobs[jobId].status = "done";
        jobs[jobId].progress.push("✅ Job complete, files saved.");
      } catch (err) {
        console.error("AI error:", err);
        jobs[jobId].status = "error";
        jobs[jobId].result = { error: err.message };
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STATUS
app.get("/status/:jobId", (req, res) => {
  res.json(jobs[req.params.jobId] || { error: "Not found" });
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
  if (fs.existsSync(previewFile)) {
    return res.sendFile(previewFile);
  }
  // fallback (rare)
  const any = listAllFilesRecursive(dir).find(f => f.toLowerCase().endsWith("generator.html"));
  if (any) return res.sendFile(path.join(dir, any));
  return res.status(404).send("⚠️ No preview found");
});

// CHAT (existing-files-first updates + plain-text sidebar)
app.post("/api/chat/:jobId", async (req, res) => {
  const { message } = req.body;
  const jobId = req.params.jobId;

  if (!jobs[jobId]) return res.status(404).json({ error: "Job not found" });

  const dir = jobDirOf(jobId);
  const manifest = readJSONSafe(path.join(dir, MANIFEST), { files: [] });
  const existingFiles = manifest.files.filter(f => f !== MANIFEST && f !== PREVIEW_HTML);

  jobs[jobId].messages = jobs[jobId].messages || [];
  jobs[jobId].messages.push({ role: "user", content: message });

  const systemRules = `You are Dream2Design AI.

IMPORTANT RULES:
- You are editing an EXISTING project. DO NOT create new files unless absolutely necessary.
- Prefer updating these files: 
${existingFiles.map(f => `- ${f}`).join("\n")}
- If a new component/page is needed, integrate it into the most relevant existing file(s) above.
- Return ONLY JSON when you are sending code updates:
  {
    "files": { "path/to/file": "full new file content", ... },
    "preview": "<!DOCTYPE html>... (optional updated live preview HTML)"
  }
- If the user asks for explanations, suggestions, or reasoning, answer in plain text (NO CODE JSON).`;

  const messages = [
    { role: "system", content: systemRules },
    ...jobs[jobId].messages
  ];

  try {
    // --- Robust OpenRouter call with fallback ---
    const or = await callOpenRouterRobust(messages, {
      temperature: 0.3,
      max_tokens: 4000
    });

    const reply = or.ok ? or.content : "⏳ The model didn’t send a message (auto-retried). Please rephrase and try again.";
    jobs[jobId].messages.push({ role: "assistant", content: reply });

    // parse possible JSON block from mixed reply
    const parsed = normalizeAIJson(reply);

    let filesUpdated = false;
    let newFiles = [];
    let chatReply = reply; // default plain text to sidebar

    if (parsed && parsed.files && Object.keys(parsed.files).length > 0) {
      const updated = [];

      // fresh list of current files in project
      const currentList = listAllFilesRecursive(dir).filter(
        f => f !== MANIFEST && f !== PREVIEW_HTML
      );

      for (const [incomingName, content] of Object.entries(parsed.files)) {
        let target = currentList.includes(incomingName)
          ? incomingName
          : pickBestTarget(currentList, incomingName);

        if (!target) {
          // allow new file only if this extension doesn't exist anywhere yet
          const ext = path.extname(incomingName).toLowerCase();
          const hasExt = currentList.some(f => path.extname(f).toLowerCase() === ext);
          if (!hasExt) {
            target = incomingName;
          } else {
            continue; // skip creating extra files
          }
        }

        writeFileSafe(path.join(dir, target), content);
        if (!updated.includes(target)) updated.push(target);
      }

      if (parsed.preview && typeof parsed.preview === "string") {
        writeFileSafe(path.join(dir, PREVIEW_HTML), parsed.preview);
      }

      if (updated.length > 0) {
        filesUpdated = true;
        newFiles = updated;
        chatReply = `✅ Updated files: ${updated.join(", ")} (no new files created)`;

        // refresh manifest
        const refreshed = listAllFilesRecursive(dir).filter(f => f !== MANIFEST && f !== PREVIEW_HTML);
        writeFileSafe(path.join(dir, MANIFEST), JSON.stringify({ files: refreshed }, null, 2));
      }
    }

    res.json({ reply: chatReply, filesUpdated, newFiles });
  } catch (err) {
    console.error("CHAT error:", err);
    res.status(500).json({ error: err.message });
  }
});

// SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Dream2Design backend running on http://localhost:${PORT}`));
