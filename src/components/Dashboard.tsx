import React, { useEffect, useState } from "react";
import { Card, CardLabel, Metric, Badge, cn } from "./ui";
import { Zap, Activity, AlertTriangle, ShieldCheck, Database, Server, Clock } from "lucide-react";
import { apiFetch } from "../lib/api";

export function Dashboard() {
  const [status, setStatus] = useState<any>(null);
  const [latest, setLatest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      const [{ data: st }, { data: sig }] = await Promise.all([
        apiFetch("/system/status"),
        apiFetch("/latest-signal")
      ]);
      setStatus(st);
      setLatest(sig);
      setLoading(false);
    };
    fetchInfo();
    const intv = setInterval(fetchInfo, 5000);
    return () => clearInterval(intv);
  }, []);

  if (loading) {
    return <div className="text-brand-text-sec animate-pulse p-4">Initializing Matrix...</div>;
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* System Alerts */}
      {status?.isNewsBlocked && (
        <div className="bg-brand-warning/10 border border-brand-warning text-brand-warning p-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-semibold">HIGH IMPACT NEWS AHEAD (Trading Blocked)</span>
          </div>
        </div>
      )}

      {/* Overview Grid */}
      <div className="grid grid-cols-3 gap-[8px]">
        <Card className="h-[90px] justify-between overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="text-[14px] font-medium text-brand-text-sec uppercase tracking-tight truncate pr-1">Engine</div>
            <Activity className="w-4 h-4 text-brand-success shrink-0" />
          </div>
          <div className={cn(
            status?.engineMode === "NEWS" ? "text-brand-warning" : "text-brand-success",
            "text-[18px] font-bold font-mono tracking-tight truncate leading-none tabular-nums"
          )}>
            {status?.engineMode || "STANDARD"}
          </div>
        </Card>
        <Card className="h-[90px] justify-between overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="text-[14px] font-medium text-brand-text-sec uppercase tracking-tight truncate pr-1">XAUUSD</div>
            <Activity className="w-4 h-4 text-brand-success shrink-0" />
          </div>
          <div className="text-brand-success text-[18px] font-bold font-mono tracking-tight truncate leading-none tabular-nums">
            {status?.prices?.XAUUSD ? status.prices.XAUUSD.toFixed(2) : "..."}
          </div>
        </Card>
        <Card className="h-[90px] justify-between overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="text-[14px] font-medium text-brand-text-sec uppercase tracking-tight truncate pr-1">EURUSD</div>
            <Activity className="w-4 h-4 text-brand-info shrink-0" />
          </div>
          <div className="text-brand-info text-[18px] font-bold font-mono tracking-tight truncate leading-none tabular-nums">
            {status?.prices?.EURUSD ? status.prices.EURUSD.toFixed(5) : "..."}
          </div>
        </Card>
      </div>

      <h2 className="text-[15px] font-semibold text-brand-text mt-2">
        {status?.engineMode === "NEWS" ? "News Sweep Setup" : "SMC Engine Setup"}
      </h2>
      <Card className="flex flex-col gap-3">
        <SetupStep label="Market Bias" active={!!status?.setup?.bias} value={status?.setup?.bias || "NEUTRAL"} />
        <SetupStep label="FVG Detect" active={!!status?.setup?.fvg} value={status?.setup?.fvg ? `${status.setup.fvg} FVG` : "NONE"} />
        {status?.engineMode === "NEWS" ? (
          <>
            <SetupStep label="Vol Spillover" active={!!status?.setup?.discountZone} value={status?.setup?.discountZone ? "DETECTED" : "NORMAL"} />
            <SetupStep label="Liquidity Sweep" active={!!status?.setup?.choch} value={status?.setup?.choch || "NONE"} />
          </>
        ) : (
          <>
            <SetupStep label="Midpoint Touched" active={status?.setup?.midpoint} value={status?.setup?.midpoint ? "YES" : "NO"} />
            <SetupStep label="Discount Zone" active={status?.setup?.discountZone} value={status?.setup?.discountZone ? "YES" : "NO"} />
            <SetupStep label="BOS/CHOCH Confirm" active={!!status?.setup?.choch} value={status?.setup?.choch || "NONE"} />
          </>
        )}
      </Card>

      {/* Latest Signal Compact */}
      <h2 className="text-[15px] font-semibold text-brand-text mt-2">Latest Validation</h2>
      {latest ? (
        <Card className={cn(
          "border-l-4",
          latest.type === "BUY" ? "border-l-brand-success" : "border-l-brand-danger"
        )}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Badge variant={latest.type === "BUY" ? "success" : "danger"}>{latest.type}</Badge>
              <span className="text-sm font-bold">{latest.symbol}</span>
            </div>
            <Badge variant={latest.ai_verdict === "HIGH_QUALITY" ? "accent" : "warning"}>
              {latest.ai_verdict === "HIGH_QUALITY" ? "AI APPROVED" : "FLAGGED"}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div>
              <div className="text-[10px] text-brand-text-sec uppercase">Entry</div>
              <div className="text-sm font-mono font-medium tabular-nums">{latest.entry.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-brand-text-sec uppercase">SL (1.0 ATR)</div>
              <div className="text-sm font-mono font-medium text-brand-danger tabular-nums">{latest.sl.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-brand-text-sec uppercase">TP2 (4.0 RR)</div>
              <div className="text-sm font-mono font-medium text-brand-success tabular-nums">{latest.tp2.toFixed(2)}</div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col items-center justify-center py-4 text-brand-text-sec">
            <ShieldCheck className="w-8 h-8 mb-2 opacity-50" />
            <div className="text-sm font-medium">No Active Signals</div>
            <div className="text-xs opacity-75">Scanning market structure...</div>
          </div>
        </Card>
      )}

      {/* Connection Monitor */}
      <h2 className="text-[15px] font-semibold text-brand-text mt-2">Core Services</h2>
      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-brand-border">
          <ConnectionRow icon={<Server />} label="Trading Backend" status={status?.status} />
          <ConnectionRow icon={<Database />} label="Firestore Sink" status={status?.firestore} />
          <ConnectionRow icon={<Activity />} label="TwelveData Feed" status={status?.market_feed} />
          <ConnectionRow icon={<Zap />} label="Gemini AI Validator" status={status?.gemini} />
        </div>
      </Card>

    </div>
  );
}

function ConnectionRow({ icon, label, status }: { icon: React.ReactNode; label: string; status: string }) {
  const isOnline = status === "ONLINE";
  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center gap-3 text-sm font-medium text-brand-text">
        <div className="text-brand-text-sec">{icon}</div>
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] font-bold tracking-wider uppercase", isOnline ? "text-brand-success" : "text-brand-danger")}>
          {status || "UNKNOWN"}
        </span>
        <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-brand-success" : "bg-brand-danger")}></span>
      </div>
    </div>
  );
}

function SetupStep({ label, active, value }: { label: string; active: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
          active ? "bg-brand-success/20 border-brand-success" : "bg-brand-bg-sec border-brand-border"
        )}>
          {active && <div className="w-2 h-2 rounded-full bg-brand-success" />}
        </div>
        <span className={cn("text-xs font-semibold", active ? "text-brand-text" : "text-brand-text-sec")}>{label}</span>
      </div>
      <Badge variant={active ? "accent" : "default"}>{value}</Badge>
    </div>
  );
}
