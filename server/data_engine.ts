import axios from "axios";
import yahooFinance from "yahoo-finance2";
import WebSocket from "ws";
import { sendTelegramMessage } from "./telegram.js";
import { addSystemError, systemState } from "./engine.js";


export interface OHLC {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

let hasNotifiedTwelveDataFailure = false;
let wsClient: WebSocket | null = null;
let wsConnected = false;
let fallbackInterval: NodeJS.Timeout | null = null;

export function initializeDataFeed() {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    addSystemError("No TWELVEDATA_API_KEY. WebSocket price streaming disabled.");
    startFallbackPolling();
    return;
  }

  connectWebSocket(apiKey);
}

function connectWebSocket(apiKey: string) {
  const url = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKey}`;
  wsClient = new WebSocket(url);

  wsClient.on("open", () => {
    wsConnected = true;
    stopFallbackPolling();
    
    // Subscribe to symbols
    wsClient?.send(JSON.stringify({
      action: "subscribe",
      params: {
        symbols: "XAU/USD,EUR/USD"
      }
    }));
  });

  wsClient.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.event === "price") {
        const symbol = msg.symbol;
        const price = parseFloat(msg.price);
        if (symbol === "XAU/USD" && price > 0) {
          systemState.prices.XAUUSD = price;
        } else if (symbol === "EUR/USD" && price > 0) {
          systemState.prices.EURUSD = price;
        }
      }
    } catch (err) {
      // ignore parse errors
    }
  });

  wsClient.on("error", (err) => {
    addSystemError(`TwelveData WS Error: ${err.message}`);
  });

  wsClient.on("close", () => {
    if (wsConnected) {
      sendTelegramMessage("⚠️ *TWELVEDATA WS DISCONNECTED* \nFalling back to REST API polling.");
      wsConnected = false;
    }
    startFallbackPolling();
    // Attempt reconnect after 10s
    setTimeout(() => connectWebSocket(apiKey), 10000);
  });
}

function startFallbackPolling() {
  if (fallbackInterval) return;
  fallbackInterval = setInterval(async () => {
    try {
      const pGold = await fetchLatestPrice("GC=F");
      if (pGold) systemState.prices.XAUUSD = pGold;
    } catch (err: any) { 
        addSystemError(`Gold price fallback feed error: ${err.message}`);
    }
    try {
      const pEur = await fetchLatestPrice("EURUSD=X");
      if (pEur) systemState.prices.EURUSD = pEur;
    } catch (err: any) { 
        addSystemError(`EURUSD price fallback feed error: ${err.message}`);
    }
  }, 10000);
}

function stopFallbackPolling() {
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
}

export async function fetchLatestPrice(symbol: string): Promise<number | null> {
  const apiKey = process.env.TWELVEDATA_API_KEY;

  if (apiKey) {
    try {
      const tdSymbol = symbol === "GC=F" ? "XAU/USD" : symbol === "EURUSD=X" ? "EUR/USD" : symbol;
      const url = `https://api.twelvedata.com/price?symbol=${tdSymbol}&apikey=${apiKey}`;
      const res = await axios.get(url);
      if (res.data && res.data.price) {
        return parseFloat(res.data.price);
      }
      if (res.data && res.data.code === 429) {
        throw new Error("429 Too Many Requests");
      }
    } catch (err: any) {
      console.error(`TwelveData Price Failed for ${symbol}, falling back to Yahoo...`);
      addSystemError(`TwelveData Price Failed for ${symbol}: ${err.message}`);
      if (!hasNotifiedTwelveDataFailure) {
        sendTelegramMessage(`⚠️ *TWELVEDATA API FAILURE* \nQuota exhausted or error.\nSystem falling back to Yahoo Finance for ${symbol}. \nError: ${err.message}`);
        hasNotifiedTwelveDataFailure = true;
      }
    }
  }

  try {
    const quote = await yahooFinance.quote(symbol) as any;
    return quote.regularMarketPrice || null;
  } catch (err) {
    return null;
  }
}

export async function fetchMarketData(symbol: string, interval: string, count: number): Promise<OHLC[]> {
  try {
    const data = await fetchTwelveData(symbol, interval, count);
    if (!data || data.length === 0) throw new Error("Empty TwelveData");
    hasNotifiedTwelveDataFailure = false; // Reset if it works again
    return data;
  } catch (err: any) {
    console.error(`TwelveData Failed for ${symbol}, falling back to Yahoo Finance...`);
    if (!hasNotifiedTwelveDataFailure) {
      sendTelegramMessage(`⚠️ *TWELVEDATA API FAILURE* \nQuota exhausted or error.\nSystem falling back to Yahoo Finance for ${symbol}. \nError: ${err.message}`);
      hasNotifiedTwelveDataFailure = true;
    }
    try {
      return await fetchYahooFinance(symbol, interval, count);
    } catch (fallbackErr: any) {
      console.error(`Yahoo Finance Failed for ${symbol}:`, fallbackErr?.message || String(fallbackErr));
      addSystemError(`Yahoo Finance Data Fetch Failed for ${symbol}: ${fallbackErr.message}`);
      throw new Error("All Market Data Sources Failed");
    }
  }
}

async function fetchTwelveData(symbol: string, interval: string, count: number): Promise<OHLC[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) throw new Error("No TWELVEDATA_API_KEY in environment");
  
  // TwelveData needs symbol translation if needed
  const tdSymbol = symbol === "GC=F" ? "XAU/USD" : symbol === "EURUSD=X" ? "EUR/USD" : symbol;
  // Map interval logic: M1, M5, M15, H1, H4
  const tdInterval = interval.replace("M", "min").replace("H", "h");

  const url = `https://api.twelvedata.com/time_series?symbol=${tdSymbol}&interval=${tdInterval}&outputsize=${count}&apikey=${apiKey}`;
  const response = await axios.get(url);
  
  if (response.data.status !== "ok") {
    throw new Error(response.data.message || "TwelveData API Error");
  }

  const values = response.data.values;
  return values.map((v: any) => ({
    timestamp: new Date(v.datetime),
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
    volume: parseFloat(v.volume) || 0
  })).reverse(); // Reverse so oldest is first, newest is last.
}

async function fetchYahooFinance(symbol: string, interval: string, count: number): Promise<OHLC[]> {
  let period1 = new Date();
  
  // subtract time depending on interval to ensure enough bars
  let multiplier = 1;
  if (interval === "1m") multiplier = 1;
  else if (interval === "5m") multiplier = 5;
  else if (interval === "15m") multiplier = 15;
  else if (interval === "1h") multiplier = 60;
  
  period1.setMinutes(period1.getMinutes() - (count * multiplier * 2) - (5 * 24 * 60)); // Add 5 days buffer for weekends and holidays
  
  let validInterval = interval; // yahoo uses 1m, 2m, 5m, 15m, 30m, 60m
  if (interval === "H1") validInterval = "60m";
  else if (interval === "H4") validInterval = "60m"; // Yahoo doesn't support 4h directly in chart, we'll request 60m and aggregate if needed, for simplicity we throw or request 60m.
  else if (interval === "M1") validInterval = "1m";
  else if (interval === "M5") validInterval = "5m";
  else if (interval === "M15") validInterval = "15m";

  const result = await yahooFinance.chart(symbol, {
    period1: period1,
    interval: validInterval as any,
  }) as any;

  if (!result || !result.quotes || result.quotes.length === 0) {
    throw new Error("Yahoo Finance returned no quotes");
  }

  let quotes = result.quotes.filter(q => q.open !== null && q.high !== null && q.open !== undefined);
  
  if (quotes.length > count) {
    quotes = quotes.slice(-count);
  }

  return quotes.map(q => ({
    timestamp: q.date,
    open: q.open!,
    high: q.high!,
    low: q.low!,
    close: q.close!,
    volume: q.volume || 0
  }));
}
