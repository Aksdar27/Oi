import TelegramBot from "node-telegram-bot-api";
import { addSystemError } from "./engine.js";

let bot: TelegramBot | null = null;

export function initTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("No TELEGRAM_BOT_TOKEN. Telegram will not send messages.");
    return;
  }
  
  bot = new TelegramBot(token, { polling: false });
}

export async function sendTelegramSignal(signal: any) {
  if (!bot) return;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const msg = `
🚨 **${signal.symbol} SIGNAL**
Mode: ${signal.mode}
Type: ${signal.type}
Entry: ${signal.entry}
SL: ${signal.sl}
TP1: ${signal.tp1}
TP2: ${signal.tp2}
Confidence: ${signal.confidence}
AI Verdict: ${signal.ai_verdict}
Timestamp: ${signal.timestamp}
  `.trim();

  try {
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  } catch (err: any) {
    console.error("Telegram Send Error:", err?.message || String(err));
    addSystemError(`Telegram Send Error: ${err.message}`);
  }
}

export async function sendTelegramMessage(text: string) {
  if (!bot) return;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  try {
    await bot.sendMessage(chatId, text);
  } catch (err: any) {
    console.error("Telegram Send Error:", err?.message || String(err));
    addSystemError(`Telegram Message Error: ${err.message}`);
  }
}
