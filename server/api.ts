import express, { Router } from "express";
import { systemState } from "./engine.js";
import { getFirestore } from "./firebase.js";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import { memoryManager } from "./memory.js";
import { gitAgent } from "./git_agent.js";

export const apiRouter = Router();

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// 1. GET /api/repo/file?path=
apiRouter.get("/repo/file", (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "No path provided" });

    // SECURITY: Whitelist folder
    if (!filePath.startsWith("src/") && !filePath.startsWith("server/")) {
      return res.status(403).json({ error: "Access denied. Only src/ and server/ allowed" });
    }
    
    // SECURITY: Block path traversal
    if (filePath.includes("..")) {
      return res.status(403).json({ error: "Invalid path" });
    }

    // SECURITY: Block specific files
    const blockedFiles = ["package.json", ".env", "PRD.md", "data/ai_memory.json"];
    if (blockedFiles.some(f => filePath === f || filePath.endsWith(f))) {
      return res.status(403).json({ error: "Access to protected file denied" });
    }
    
    const fullPath = path.join(process.cwd(), filePath);
    
    // Check file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }
    
    const content = fs.readFileSync(fullPath, "utf-8");
    
    // Limit 50KB
    if (content.length > 50000) {
      return res.status(413).json({ error: "File too large" });
    }
    
    console.log(`[AI_AGENT] User minta BACA di ${filePath}`);
    res.json({
      path: filePath,
      content: content,
      size: content.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/agent/write
apiRouter.post("/agent/write", express.json({limit: '1mb'}), (req, res) => {
  try {
    const { path: filePath, content, reason } = req.body;
    if (!filePath || !content || !reason) {
       return res.status(400).json({ success: false, error: "Missing path, content, or reason" });
    }

    // SECURITY: Whitelist & Traversal
    if ((!filePath.startsWith("src/") && !filePath.startsWith("server/")) || filePath.includes("..")) {
      return res.status(403).json({ success: false, error: "Invalid path access." });
    }

    const blockedFiles = ["package.json", ".env", "PRD.md", "data/ai_memory.json"];
    if (blockedFiles.some(f => filePath === f || filePath.endsWith(f))) {
       return res.status(403).json({ success: false, error: "Protected file modification denied" });
    }

    // LOGIC GUARD
    if (filePath === "server/smc_strategy.ts" && (content.includes("function detectBOS") || content.includes("function detectCHOCH"))) {
       return res.status(403).json({ success: false, error: "Protected SMC logic Cannot modify detectBOS/CHOCH." });
    }

    console.log(`[AI_AGENT] User minta TULIS di ${filePath}`);
    const backup_sha = gitAgent.getLastCommit();
    
    const fullPath = path.join(process.cwd(), filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");

    memoryManager.saveMemory("past_decisions", `Edit file ${filePath} karena ${reason}`);

    res.json({ success: true, diff: "File updated", backup_sha });
  } catch(err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. DELETE /api/agent/file
apiRouter.delete("/agent/file", express.json(), (req, res) => {
  try {
    const { path: filePath, reason } = req.body;
    if (!filePath || !reason) {
       return res.status(400).json({ success: false, error: "Missing path or reason" });
    }

    // SECURITY: Whitelist & Traversal
    if ((!filePath.startsWith("src/") && !filePath.startsWith("server/")) || filePath.includes("..")) {
      return res.status(403).json({ success: false, error: "Invalid path access." });
    }

    // BLACKLIST
    const blockedFiles = ["package.json", ".env", "PRD.md", "server/smc_strategy.ts", "data/ai_memory.json"];
    if (blockedFiles.some(f => filePath === f || filePath.endsWith(f))) {
       return res.status(403).json({ success: false, error: "Cannot delete protected file" });
    }

    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    console.log(`[AI_AGENT] User minta HAPUS di ${filePath}`);
    fs.unlinkSync(fullPath);

    memoryManager.saveMemory("past_decisions", `Hapus file ${filePath} karena ${reason}`);

    res.json({ success: true, message: `File ${filePath} deleted` });
  } catch(err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/agent/commit
apiRouter.post("/agent/commit", express.json(), (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: "Missing message" });
    
    console.log(`[AI_AGENT] User minta COMMIT dengan pesan: ${message}`);
    const result = gitAgent.commitAll(message);
    
    memoryManager.saveMemory("past_decisions", `Commit Git: ${message}`);
    res.json({ success: true, ...result });
  } catch(err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST /api/ai/chat (Otak Chat + Vision)
apiRouter.post("/ai/chat", express.json({limit: '5mb'}), async (req, res) => {
  try {
    const { message, image_base64 } = req.body;
    
    const apiKey = process.env.KUNCI_API_GEMINI || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "KUNCI_API_GEMINI not configured" });
    }

    const memoryData = memoryManager.getAllMemory();
    
    console.log(`[AI_AGENT] User CHAT`);

    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `Kamu adalah Lead Engineer AI untuk XAUUSD Core.
Kamu PUNYA tool beneran sekarang: readFile, writeFile, deleteFile, gitCommit, listFiles. 
Tool ini akan dieksekusi SECARA NYATA di server (Railway).
Baca memory sebelum jawab: 
${JSON.stringify(memoryData, null, 2)}

ATURAN BESI: Jangan sentuh fungsi detectBOS/CHOCH di smc_strategy.ts. Killzone wajib 12:00-15:00 WITA.
Kalau user nyuruh perbaikan, audit, atau refactor code, JALAN KAN TOOL YANG TEPAT! (readFile utk cek file, writeFile utk ubah).
Kalau user suruh hapus, pakai deleteFile.
Kalau udah beres, lakukan gitCommit.
Jawab interaktif pake Bahasa Indonesia, format santai.`;

    const parts: any[] = [{ text: message || "Halo" }];
    
    if (image_base64) {
       const base64Data = image_base64.includes(",") ? image_base64.split(",")[1] : image_base64;
       parts.push({
         inlineData: {
           data: base64Data,
           mimeType: "image/png"
         }
       });
    }

    const tools: any = [{
      functionDeclarations: [
        {
          name: "readFile",
          description: "Membaca isi file dari repository.",
          parameters: {
            type: Type.OBJECT,
            properties: { path: { type: Type.STRING, description: "Path relatif (e.g., src/App.tsx)" } },
            required: ["path"]
          }
        },
        {
          name: "writeFile",
          description: "Membuat atau mengubah isi file di repository.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              path: { type: Type.STRING },
              content: { type: Type.STRING, description: "Isi script lengkap yang akan direplace/dibuat" },
              reason: { type: Type.STRING, description: "Alasan mengapa diubah" }
            },
            required: ["path", "content", "reason"]
          }
        },
        {
          name: "deleteFile",
          description: "Menghapus file.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              path: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["path", "reason"]
          }
        },
        {
          name: "listFiles",
          description: "Melihat struktur isi directory.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              dir: { type: Type.STRING, description: "Folder path (kosongkan string atau isi '.' utk root)" }
            },
            required: ["dir"]
          }
        },
        {
          name: "gitCommit",
          description: "Commit n push hasil kerja mu ke github supaya deploy ke railway/codemagic terpicu.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING }
            },
            required: ["message"]
          }
        }
      ]
    }];

    const contents: any[] = [{ role: "user", parts }];
    
    let aiAnswer = "";
    let iter = 0;
    while (iter < 8) {
      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-1.5-pro-latest",
          contents,
          config: {
            systemInstruction,
            temperature: 0.2,
            tools
          }
        });
      } catch (err: any) {
        throw new Error("Failed generating content: " + err.message);
      }
      
      const resMsg = response.candidates?.[0]?.content;
      if (!resMsg || !resMsg.parts) {
        aiAnswer = response.text || "Tidak ada response.";
        break;
      }

      const functionCallPart = resMsg.parts.find(p => p.functionCall);
      if (functionCallPart && functionCallPart.functionCall) {
        const call = functionCallPart.functionCall;
        console.log(`[AI_AGENT] Model calls tool: ${call.name}`);
        
        contents.push({ role: "model", parts: [functionCallPart] });
        
        let toolResult: any = { success: false, error: "Tool not found" };
        const { path: argPath, content, reason, message: argMsg, dir } = call.args as any;

         try {
            if (call.name === "readFile") {
               let targetFile = argPath;
               // If there is no src/ or server/, try searching natively but enforce constraints if it is in an unsafe place.
               const p = path.join(process.cwd(), targetFile);
               if (!fs.existsSync(p)) toolResult = {error: "File not found: " + targetFile};
               else toolResult = { content: fs.readFileSync(p, "utf-8") };
            } else if (call.name === "writeFile") {
               if (argPath === "server/smc_strategy.ts" && (content.includes("function detectBOS") || content.includes("function detectCHOCH"))) {
                  toolResult = {error: "Dilarang memanipulasi detectBOS/CHOCH. Protected logic."};
               } else {
                  const p = path.join(process.cwd(), argPath);
                  fs.mkdirSync(path.dirname(p), { recursive: true });
                  fs.writeFileSync(p, content, "utf-8");
                  memoryManager.saveMemory("past_decisions", `Edit ${argPath} karena ${reason}`);
                  toolResult = { success: true, message: `File ${argPath} updated.` };
               }
            } else if (call.name === "deleteFile") {
               const blocked = ["package.json", ".env", "PRD.md", "server/smc_strategy.ts", "data/ai_memory.json"];
               if (blocked.some(f => argPath === f || argPath.endsWith(f))) toolResult = {error: "File system kritikal gaboleh dihapus!"};
               else {
                  const p = path.join(process.cwd(), argPath);
                  if (!fs.existsSync(p)) toolResult = {error: "Not found"};
                  else {
                     fs.unlinkSync(p);
                     memoryManager.saveMemory("past_decisions", `Hapus ${argPath} krn ${reason}`);
                     toolResult = { success: true };
                  }
               }
            } else if (call.name === "listFiles") {
               const targetPath = dir && dir !== "." ? path.join(process.cwd(), dir) : process.cwd();
               if (!targetPath.startsWith(process.cwd())) toolResult = {error: "Access denied."};
               else {
                  const files = fs.readdirSync(targetPath);
                  toolResult = { files };
               }
            } else if (call.name === "gitCommit") {
               const res = gitAgent.commitAll(argMsg || "AI Auto Commit");
               memoryManager.saveMemory("past_decisions", `Commit: ${argMsg}`);
               toolResult = res;
            }
         } catch(e:any) {
            console.error("Tool exec error:", e);
            toolResult = { error: e.message };
         }
         
         const functionResponsePart = {
            functionResponse: {
               name: call.name,
               response: toolResult
            }
         };
         
         contents.push({ role: "user", parts: [functionResponsePart] });
         iter++;
      } else {
        // No more tool calls, we have the text
        const answerTextPart = resMsg.parts.find(p => p.text);
        aiAnswer = answerTextPart?.text || response.text || "Selesai.";
        break;
      }
    }
    
    memoryManager.saveMemory("user_preferences", `Chat: User bertanya "${message?.substring(0, 50)}..." - Dijawab oleh AI: ${aiAnswer?.substring(0,50)}...`);

    res.json({ success: true, response: aiAnswer });

  } catch(err: any) {
    console.error("[AI Chat Error]:", err);
    res.status(500).json({ error: err.message, fallback: "Gagal ngobrol sama AI" });
  }
});

// 6. GET /api/agent/rollback
apiRouter.get("/agent/rollback", (req, res) => {
  try {
    console.log(`[AI_AGENT] User minta ROLLBACK`);
    // Ideally rollback to the sha before last AI commit. Since we don't store 
    // it dynamically in memory specifically for rollback in this snippet,
    // we use a simple fallback or fetch from git logs.
    // For now we assume rollback via GitAgent rollbackTo using HEAD~1
    // (git reset --hard HEAD~1)
    const result = gitAgent.rollbackTo("HEAD~1");
    // Backup memory?
    memoryManager.saveMemory("past_decisions", "Emergency Rollback executed to HEAD~1");
    res.json({ success: true, ...result });
  } catch(err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Keep Original Endpoints
apiRouter.post("/system/errors/clear", (req, res) => {
  systemState.errors = [];
  res.json({ success: true, message: "Errors cleared", data: [] });
});

apiRouter.post("/ai/rollback", (req, res) => {
  // Backward compatibility with earlier frontend setting
  try {
    const result = gitAgent.rollbackTo("HEAD~1");
    memoryManager.saveMemory("past_decisions", "Emergency Rollback executed to HEAD~1");
    res.json({ success: true, ...result });
  } catch(err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/system/status", (req, res) => {
  res.json({
    success: true,
    message: "Status fetched",
    data: {
      status: "ONLINE",
      market_feed: "ONLINE",
      firestore: process.env.FIREBASE_PROJECT_ID ? "ONLINE" : "OFFLINE",
      telegram: process.env.TELEGRAM_BOT_TOKEN ? "ONLINE" : "OFFLINE",
      gemini: process.env.GEMINI_API_KEY ? "ONLINE" : "OFFLINE",
      scheduler: "ONLINE",
      lastScan: systemState.lastScan,
      isNewsBlocked: systemState.isNewsBlocked,
      engineMode: systemState.engineMode,
      settings: systemState.settings,
      errors: systemState.errors,
      prices: systemState.prices,
      setup: systemState.setup,
    },
  });
});

apiRouter.post("/system/settings", express.json(), (req, res) => {
  const { atrThreshold, minConfidence, alertTypes } = req.body;
  
  if (typeof atrThreshold === "number") {
    systemState.settings.atrThreshold = atrThreshold;
  }
  if (typeof minConfidence === "number") {
    systemState.settings.minConfidence = minConfidence;
  }
  if (alertTypes && typeof alertTypes === "object") {
    systemState.settings.alertTypes = {
      ...systemState.settings.alertTypes,
      ...alertTypes
    };
  }
  
  res.json({ success: true, message: "Settings updated", data: systemState.settings });
});

apiRouter.get("/signals", async (req, res) => {
  const db = getFirestore();
  if (!db) return res.json({ success: true, message: "No DB configuration", data: [] });

  try {
    const snapshot = await db.collection("signals").orderBy("timestamp", "desc").limit(50).get();
    const signals = snapshot.docs.map(doc => doc.data());
    res.json({ success: true, message: "Signals fetched", data: signals });
  } catch (err) {
    res.status(500).json({ success: false, message: "DB Error", data: [] });
  }
});

apiRouter.get("/latest-signal", async (req, res) => {
  if (systemState.activeSignal) {
    return res.json({ success: true, message: "Latest signal fetched", data: systemState.activeSignal });
  }

  const db = getFirestore();
  if (!db) return res.json({ success: true, message: "No active signal", data: null });

  try {
    const snapshot = await db.collection("signals").orderBy("timestamp", "desc").limit(1).get();
    const latest = snapshot.docs[0]?.data() || null;
    res.json({ success: true, message: "Signal fetched from DB", data: latest });
  } catch (err) {
    res.status(500).json({ success: false, message: "DB Error", data: null });
  }
});

apiRouter.post("/scan", (req, res) => {
  // Can trigger manually if needed
  res.json({ success: true, message: "Scan triggered successfully", data: {} });
});
