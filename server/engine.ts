import cron from "node-cron";
import { toZonedTime } from "date-fns-tz";
import { fetchMarketData, OHLC, initializeDataFeed } from "./data_engine.js";
import { analyzeStructure, detectFVG, calculateATR, validateEntry } from "./smc_strategy.js";
import { checkNewsBlock } from "./news_engine.js";
import { validateSignalWithAI } from "./ai_engine.js";
import { sendTelegramSignal } from "./telegram.js";
import { getFirestore } from "./firebase.js";
import { validateNewsEntry } from "./news_strategy.js";

const TIMEZONE = "Asia/Makassar";

export function initializeEngines() {
  console.log("Initializing XAUUSD SMC AI System...");
  
  initializeDataFeed();

  // Run every 60 seconds
  cron.schedule("* * * * *", async () => {
    try {
      await runTradingPipeline("GC=F", "XAUUSD", "H1", "M5", "M1", "Scalping");
      // await runTradingPipeline("EURUSD=X", "EURUSD", "H1", "M5", "M1", "Scalping");
    } catch (err) {
      console.error("Pipeline Error:", err);
    }
  });
}

function checkKillzone() {
  const now = new Date();
  const zonedDate = toZonedTime(now, TIMEZONE);
  const hour = zonedDate.getHours();
  const minute = zonedDate.getMinutes();

  // 15:00 - 18:00
  if (hour >= 15 && hour < 18) return true;
  if (hour === 18 && minute === 0) return true;

  // 21:30 - 00:00
  if (hour === 21 && minute >= 30) return true;
  if (hour >= 22 && hour <= 23) return true;
  if (hour === 0 && minute === 0) return true;

  return false;
}

// Global variable to keep track of state to broadcast via API 
export const systemState: any = {
  activeSignal: null,
  lastScan: null,
  isNewsBlocked: false,
  engineMode: "STANDARD",
  settings: {
    atrThreshold: 2.5,
    minConfidence: 78,
    alertTypes: {
      buy: true,
      sell: true,
      scalping: true,
      intraday: true
    }
  },
  errors: [],
  prices: { XAUUSD: 0, EURUSD: 0 },
  setup: {
    bias: null,
    fvg: null,
    midpoint: false,
    discountZone: false,
    choch: null
  }
};

export function addSystemError(msg: any) {
  const messageStr = typeof msg === 'string' ? msg : (msg?.message || String(msg));
  systemState.errors.unshift({ time: new Date().toISOString(), message: messageStr });
  if (systemState.errors.length > 5) systemState.errors.pop();
}

async function runTradingPipeline(symbolFetch: string, symbolDisp: string, tfBias: string, tfExec: string, tfConfirm: string, mode: string) {
  systemState.lastScan = new Date();
  const inKillzone = checkKillzone();
  if (!inKillzone) {
    console.log(`Outside Killzone for ${symbolDisp} (WAITING_KILLZONE)`);
    return;
  }

  // News Check
  const newsStatus = await checkNewsBlock();
  systemState.isNewsBlocked = newsStatus.isBlocked;
  const isNewsMode = newsStatus.isBlocked;
  systemState.engineMode = isNewsMode ? "NEWS" : "STANDARD";

  if (isNewsMode) {
    console.log(`News Detected for ${symbolDisp} (${newsStatus.reason}). Switching to NEWS STRATEGY.`);
  }

  // Fetch Market Data
  let execCandles: OHLC[];
  try {
    execCandles = await fetchMarketData(symbolFetch, tfExec, 100);
    // Update live price
    if (execCandles.length > 0) {
      const livePrice = execCandles[0].close;
      if (symbolDisp === "XAUUSD") systemState.prices.XAUUSD = livePrice;
      if (symbolDisp === "EURUSD") systemState.prices.EURUSD = livePrice;
    }
  } catch (err: any) {
    console.error(`Market Data Fetch Error ${symbolDisp}:`, err.message);
    addSystemError(`Market Data Fetch Error ${symbolDisp}: ${err.message}`);
    return;
  }

  const atr = calculateATR(execCandles, 14);
  let entrySignal: any = null;
  let confidence = 0;

  if (isNewsMode) {
    const validationResult = validateNewsEntry(execCandles, systemState.settings.atrThreshold);
    // Transform checklist to match expected format for UI temporarily
    systemState.setup = {
      bias: "NEWS_VOLATILITY",
      fvg: validationResult.checklist.fvg,
      midpoint: false,
      discountZone: validationResult.checklist.volatilitySpike,
      choch: validationResult.checklist.liquiditySweep ? "SWEEP" : null
    };

    entrySignal = validationResult.signalType;
    if (entrySignal) {
      if (validationResult.checklist.volatilitySpike) confidence += 40;
      if (validationResult.checklist.liquiditySweep) confidence += 40;
      entrySignal.structureState = { trend: "NEWS_SWEEP" }; // mock structure state 
      entrySignal.fvg_type = validationResult.checklist.fvg;
    }
  } else {
    const structure = analyzeStructure(execCandles);
    const currentFvg = detectFVG(execCandles);

    const validationResult = validateEntry(execCandles, structure, currentFvg);
    systemState.setup = validationResult.checklist;
    entrySignal = validationResult.signalType;

    if (entrySignal) {
      if (entrySignal.structureState.trend !== "NEUTRAL") confidence += 20;
      if (entrySignal.fvg) confidence += 20;
      if (entrySignal.fib) confidence += 20;
      if (entrySignal.structureState.lastCHOCH || entrySignal.structureState.lastBOS) confidence += 20;
    }
  }

  if (!entrySignal) {
    return;
  }
  
  // Create Signal Object
  const slOffset = atr * 1.0;
  const isBuy = entrySignal.type === "BUY";
  
  const sl = isBuy ? entrySignal.price - slOffset : entrySignal.price + slOffset;
  const tp1Offset = slOffset * (mode === "Scalping" ? 2.0 : 2.5);
  const tp2Offset = slOffset * (mode === "Scalping" ? 3.5 : 4.0);
  
  const tp1 = isBuy ? entrySignal.price + tp1Offset : entrySignal.price - tp1Offset;
  const tp2 = isBuy ? entrySignal.price + tp2Offset : entrySignal.price - tp2Offset;

  const rawSignal = {
    id: `SIG_${Date.now()}`,
    timestamp: new Date().toISOString(),
    mode,
    type: entrySignal.type,
    symbol: symbolDisp,
    entry: entrySignal.price,
    sl,
    tp1,
    tp2,
    confidence, // pre-ai
    bias: entrySignal.structureState.trend,
    atr,
    fvg_high: entrySignal?.fvg?.high,
    fvg_low: entrySignal?.fvg?.low
  };

  // AI Validation
  const aiResult = await validateSignalWithAI(rawSignal);
  if (aiResult.verdict === "HIGH_QUALITY") rawSignal.confidence += 20;

  if (rawSignal.confidence < systemState.settings.minConfidence) {
    console.log(`Signal rejected, low confidence for ${symbolDisp}: ${rawSignal.confidence} < ${systemState.settings.minConfidence}`);
    return;
  }

  const finalizedSignal = {
    ...rawSignal,
    ai_verdict: aiResult.verdict,
    ai_reason: aiResult.reason,
    status: "ACTIVE",
    result: "PENDING"
  };

  systemState.activeSignal = finalizedSignal;

  // DB Save
  const db = getFirestore();
  if (db) {
    try {
      await db.collection("signals").doc(finalizedSignal.id).set({
        ...finalizedSignal,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("Firestore Save Error:", err);
      addSystemError(`Firestore Save Error: ${err.message}`);
    }
  }

  // Telegram Send Check
  const { alertTypes } = systemState.settings;
  const isTypeAllowed = finalizedSignal.type === "BUY" ? alertTypes.buy : alertTypes.sell;
  const isModeAllowed = finalizedSignal.mode === "Scalping" ? alertTypes.scalping : alertTypes.intraday;

  if (isTypeAllowed && isModeAllowed) {
    await sendTelegramSignal(finalizedSignal);
  } else {
    console.log(`Telegram alert skipped for ${finalizedSignal.type} / ${finalizedSignal.mode} due to user settings.`);
  }
}

