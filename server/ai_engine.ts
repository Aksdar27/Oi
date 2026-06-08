import { GoogleGenAI } from "@google/genai";
import { addSystemError } from "./engine.js";

export async function validateSignalWithAI(signalData: any): Promise<{ verdict: "HIGH_QUALITY" | "LOW_QUALITY", reason: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.KUNCI_API_GEMINI;
  if (!apiKey) {
    console.log("No GEMINI_API_KEY, auto-approving signal.");
    return { verdict: "HIGH_QUALITY", reason: "AI Skipped: No Key" };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
  You are an expert Smart Money Concepts (SMC) trader. Validate this potential signal setup.
  Respond strictly in JSON format with two fields: "verdict" (either "HIGH_QUALITY" or "LOW_QUALITY") and "reason" (string, max 30 words explaining why).
  
  Data:
  ${JSON.stringify(signalData, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const txt = response.text;
    if (txt) {
      const parsed = JSON.parse(txt);
      if (parsed.verdict === "HIGH_QUALITY" || parsed.verdict === "LOW_QUALITY") {
        return { verdict: parsed.verdict, reason: parsed.reason };
      }
    }
  } catch (err: any) {
    console.error("Gemini Validation Error:", err);
    addSystemError(`Gemini Validation Error: ${err.message}`);
  }

  return { verdict: "LOW_QUALITY", reason: "Validation failed to parse" };
}

export async function chatWithMechanic(message: string, history: any[]): Promise<string> {
  const apiKey = process.env.KUNCI_API_GEMINI || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "Error: KUNCI_API_GEMINI / GEMINI_API_KEY is not set in the environment variables.";
  }

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = "You are XAUUSD AI Mechanic. Expert in TypeScript, Node.js, React, SMC trading logic. User will paste errors or ask problems. Analyze errors from /api/system/status, explain cause in simple Indonesian, and provide exact code fix with file path + line number. If asked, generate full code patch.";

  // Format history for Gemini SDK
  const formattedHistory = history
    .filter((msg: any) => msg.role === "user" || msg.role === "model")
    .map((msg: any) => ({
      role: msg.role === "model" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        ...formattedHistory,
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction
      }
    });

    return response.text || "No response generated.";
  } catch (err: any) {
    console.error("Mechanic AI Error:", err);
    return `Error from AI Service: ${err.message}`;
  }
}
