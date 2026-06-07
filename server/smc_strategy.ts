import { OHLC } from "./data_engine.js";

// Returns High if Swing High, Low if Swing Low, else null
export function detectSwing(candles: OHLC[], index: number): { type: "HIGH" | "LOW", value: number, index: number } | null {
  if (index < 2 || index > candles.length - 3) return null;

  const current = candles[index];
  const p1 = candles[index - 1];
  const p2 = candles[index - 2];
  const n1 = candles[index + 1];
  const n2 = candles[index + 2];

  if (current.high > p1.high && current.high > p2.high && current.high > n1.high && current.high > n2.high) {
    return { type: "HIGH", value: current.high, index };
  }

  if (current.low < p1.low && current.low < p2.low && current.low < n1.low && current.low < n2.low) {
    return { type: "LOW", value: current.low, index };
  }

  return null;
}

export function analyzeStructure(candles: OHLC[]) {
  const swings = <{ type: "HIGH" | "LOW", value: number, index: number }[]>[];
  for (let i = 2; i < candles.length - 2; i++) {
    const swing = detectSwing(candles, i);
    if (swing) swings.push(swing);
  }

  let trend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  let lastBOS: "BULLISH" | "BEARISH" | null = null;
  let lastCHOCH: "BULLISH" | "BEARISH" | null = null;

  const highs = swings.filter(s => s.type === "HIGH");
  const lows = swings.filter(s => s.type === "LOW");

  let lastSwingHigh = highs[highs.length - 1];
  let prevSwingHigh = highs[highs.length - 2];
  let lastSwingLow = lows[lows.length - 1];
  let prevSwingLow = lows[lows.length - 2];

  // Evaluate basic trend from previous swings
  if (lastSwingHigh && prevSwingHigh && lastSwingLow && prevSwingLow) {
    if (lastSwingHigh.value > prevSwingHigh.value && lastSwingLow.value > prevSwingLow.value) {
      trend = "BULLISH";
    } else if (lastSwingHigh.value < prevSwingHigh.value && lastSwingLow.value < prevSwingLow.value) {
      trend = "BEARISH";
    }
  }

  const latestClose = candles[candles.length - 1].close;

  // BOS / CHOCH Detection
  if (trend === "BULLISH") {
    if (lastSwingHigh && latestClose > lastSwingHigh.value) {
      lastBOS = "BULLISH";
    }
    if (lastSwingLow && latestClose < lastSwingLow.value) {
      lastCHOCH = "BEARISH";
      trend = "BEARISH"; // trend shifts
    }
  } else if (trend === "BEARISH") {
    if (lastSwingLow && latestClose < lastSwingLow.value) {
      lastBOS = "BEARISH";
    }
    if (lastSwingHigh && latestClose > lastSwingHigh.value) {
      lastCHOCH = "BULLISH";
      trend = "BULLISH"; // trend shifts
    }
  } else {
    // If Neutral, break of high is bullish CHOCH/BOS
    if (lastSwingHigh && latestClose > lastSwingHigh.value) trend = "BULLISH";
    if (lastSwingLow && latestClose < lastSwingLow.value) trend = "BEARISH";
  }

  return { trend, lastBOS, lastCHOCH, lastSwingHigh, lastSwingLow, swings };
}

export function detectFVG(candles: OHLC[]) {
  // Looks for FVG in the last 3 closed candles
  if (candles.length < 4) return null;
  
  const c1 = candles[candles.length - 4];
  const c2 = candles[candles.length - 3];
  const c3 = candles[candles.length - 2];

  // Bullish FVG
  if (c1.high < c3.low) {
    return { type: "BULLISH", high: c3.low, low: c1.high, mid: (c3.low + c1.high) / 2 };
  }
  // Bearish FVG
  if (c1.low > c3.high) {
    return { type: "BEARISH", high: c1.low, low: c3.high, mid: (c1.low + c3.high) / 2 };
  }

  return null;
}

export function calculateATR(candles: OHLC[], period: number = 14) {
  if (candles.length < period + 1) return 0;
  
  let atr = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    atr += tr;
  }
  return atr / period;
}

export function calculateFibonacci(swingLow: number, swingHigh: number) {
  const diff = swingHigh - swingLow;
  return {
    fib0: swingHigh,
    fib100: swingLow,
    fib50: swingHigh - (diff * 0.50),
    fib618: swingHigh - (diff * 0.618),
  };
}

export function validateEntry(candles: OHLC[], structureState: any, fvg: any) {
  const currentPrice = candles[candles.length - 1].close;

  const checklist = {
    bias: structureState.trend !== "NEUTRAL" ? structureState.trend : null,
    fvg: fvg ? fvg.type : null,
    midpoint: false,
    discountZone: false,
    choch: structureState.lastCHOCH || structureState.lastBOS
  };

  if (!fvg || !structureState.lastSwingHigh || !structureState.lastSwingLow) return { signalType: null, checklist };

  const fib = calculateFibonacci(structureState.lastSwingLow.value, structureState.lastSwingHigh.value);
  
  let signalType: "BUY" | "SELL" | null = null;
  let entryPrice = currentPrice;

  const fibDiff = structureState.lastSwingHigh.value - structureState.lastSwingLow.value;
  const fib50Bull = structureState.lastSwingLow.value + (fibDiff * 0.5);
  const fib50Bear = structureState.lastSwingHigh.value - (fibDiff * 0.5);

  if (fvg.type === "BULLISH" && currentPrice <= fvg.mid) checklist.midpoint = true;
  if (fvg.type === "BEARISH" && currentPrice >= fvg.mid) checklist.midpoint = true;

  if (structureState.trend === "BULLISH" && currentPrice <= fib50Bull) checklist.discountZone = true;
  if (structureState.trend === "BEARISH" && currentPrice >= fib50Bear) checklist.discountZone = true;

  if (
    checklist.bias === "BULLISH" && 
    checklist.fvg === "BULLISH" &&
    checklist.midpoint && 
    checklist.discountZone && 
    checklist.choch === "BULLISH"
  ) {
    signalType = "BUY";
  }

  if (
    checklist.bias === "BEARISH" && 
    checklist.fvg === "BEARISH" &&
    checklist.midpoint && 
    checklist.discountZone && 
    checklist.choch === "BEARISH"
  ) {
    signalType = "SELL";
  }

  return { signalType: signalType ? { type: signalType, price: entryPrice, fvg, structureState, fib } : null, checklist };
}
