# ARCHITECTURE REVIEW

## 1. ARCHITECTURE OVERVIEW
The target architecture is a Fullstack System:
- **Frontend**: React 19 + TailwindCSS + Vite (Standard build to `dist/`).
- **Backend**: Express + Node.js + TypeScript (Using `server.ts` bundled with `esbuild`, matching the platform's standard).
- **Scheduler**: `node-schedule` (replaces APScheduler) running via a cron-like interval to execute the SMC (Smart Money Concept) logic pipeline.

## 2. DATABASE (FIRESTORE)
- Will use `signals` collection to store technical output.
- Will use `system` collection for system status monitoring.

## 3. SCHEDULED PIPELINE (THE TRADING ENGINE)
Executes every 60 seconds:
1. Fetch Market Data (`TwelveData` primary, `/chart` or `/quote` endpoints; Yahoo Finance fallback).
2. Check Killzone (WITA).
3. Check News Filter.
4. Calculate SMC elements (BOS, CHOCH, FVG, Fibonacci, ATR).
5. Generate Confidence Score.
6. Trigger Gemini AI Validation.
7. Insert to Firestore.
8. Send to Telegram.

## 4. API ENDPOINTS (Express)
- `POST /api/save_config`
- `GET /api/test_connection`
- `GET /api/system/status`
- `POST /api/scan`
- `GET /api/signals`
- `GET /api/latest-signal`
- `POST /api/send_signal`
- `POST /api/switch_mode`

## 5. EXTERNAL SERVICES
- **Gemini**: Usage of `@google/genai` for validation (Prompting setup in JSON output).
- **Telegram**: Webhook or Polling structure via `node-telegram-bot-api` to push signals.

## CONCLUSION
The architecture translates well to a Node.js fullstack environment. Next step: Implement the backend (Phase 3 & 5).
