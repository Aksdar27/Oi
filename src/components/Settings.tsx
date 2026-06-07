import React, { useState, useEffect } from "react";
import { Card, Badge, cn } from "./ui";
import { ChevronDown, HardDrive, Smartphone, Shield, Bell, Network, Settings as SettingsIcon, Monitor, LogOut, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiFetch } from "../lib/api";

export function Settings() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [atrNewsThreshold, setAtrNewsThreshold] = useState<number>(2.5);
  const [minConfidence, setMinConfidence] = useState<number>(78);
  const [alertTypes, setAlertTypes] = useState({
    buy: true,
    sell: true,
    scalping: true,
    intraday: true
  });
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackDisabled, setRollbackDisabled] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await apiFetch("/system/status");
        if (data?.settings?.atrThreshold) {
          setAtrNewsThreshold(data.settings.atrThreshold);
        }
        if (data?.settings?.minConfidence) {
          setMinConfidence(data.settings.minConfidence);
        }
        if (data?.settings?.alertTypes) {
          setAlertTypes(data.settings.alertTypes);
        }
      } catch (err) {}
    };
    loadSettings();
  }, []);

  const handleAtrChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setAtrNewsThreshold(val);
    try {
      await apiFetch("/system/settings", {
        method: "POST",
        body: JSON.stringify({ atrThreshold: val })
      });
    } catch (err) {}
  };

  const updateSetting = async (payload: any) => {
    try {
      await apiFetch("/system/settings", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    } catch (err) {}
  };

  const handleMinConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setMinConfidence(val);
    updateSetting({ minConfidence: val });
  };

  const toggleAlertType = (key: keyof typeof alertTypes) => {
    const newTypes = { ...alertTypes, [key]: !alertTypes[key] };
    setAlertTypes(newTypes);
    updateSetting({ alertTypes: newTypes });
  };

  const toggle = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleRollback = async () => {
    if (!window.confirm("Yakin? Ini akan reset kode ke commit sebelum AI edit.")) return;
    
    setRollbackLoading(true);
    try {
      const res = await apiFetch("/ai/rollback", { method: "POST" });
      if (res.success) {
        alert("Rollback success. Railway redeploying...");
        setRollbackDisabled(true);
        setTimeout(() => setRollbackDisabled(false), 30000);
      } else {
        alert("Rollback failed: " + res.message);
      }
    } catch(err) {
      alert("Error calling rollback endpoint.");
    } finally {
      setRollbackLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="text-[15px] font-semibold text-brand-text mb-2">Configurations</h2>

      <AccordionItem
        id="general"
        title="General"
        icon={<SettingsIcon className="w-4 h-4 text-brand-text-sec" />}
        isOpen={openSection === "general"}
        onToggle={() => toggle("general")}
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-brand-text-sec">Timezone</span>
            <Badge variant="default">Asia/Makassar</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-brand-text-sec">Base Currency</span>
            <span className="text-xs font-bold text-brand-text">USD</span>
          </div>
        </div>
      </AccordionItem>

      <AccordionItem
        id="trading"
        title="Trading"
        icon={<Monitor className="w-4 h-4 text-brand-text-sec" />}
        isOpen={openSection === "trading"}
        onToggle={() => toggle("trading")}
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5 pb-2 border-b border-brand-border/50">
            <div className="flex justify-between items-center">
              <span className="text-xs text-brand-text-sec">News ATR Spillover Threshold</span>
              <span className="text-xs font-mono text-brand-text">{atrNewsThreshold.toFixed(1)}x</span>
            </div>
            <input 
              type="range" 
              min="1.5" 
              max="4.0" 
              step="0.1" 
              value={atrNewsThreshold} 
              onChange={handleAtrChange}
              className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-accent"
            />
            <span className="text-[10px] text-brand-text-sec">Controls the volatility spike trigger required during News Mode for XAUUSD M5.</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-brand-text-sec">Scalp Risk (ATR)</span>
            <span className="text-xs font-mono text-brand-text">1.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-brand-text-sec">Intraday Risk (ATR)</span>
            <span className="text-xs font-mono text-brand-text">1.5</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-brand-text-sec">News Filter Window</span>
            <Badge variant="warning">±15 MIN</Badge>
          </div>
        </div>
      </AccordionItem>

      <AccordionItem
        id="alerts"
        title="Alerts & Notifications"
        icon={<Bell className="w-4 h-4 text-brand-text-sec" />}
        isOpen={openSection === "alerts"}
        onToggle={() => toggle("alerts")}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5 pb-3 border-b border-brand-border/50">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-brand-text">Min Confidence Score</span>
              <span className="text-xs font-mono text-brand-text">{minConfidence}%</span>
            </div>
            <input 
              type="range" 
              min="50" 
              max="100" 
              step="1" 
              value={minConfidence} 
              onChange={handleMinConfidenceChange}
              className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-accent"
            />
            <span className="text-[10px] text-brand-text-sec">Minimum AI confidence score required to trigger a Telegram alert.</span>
          </div>
          
          <div className="space-y-2">
            <span className="text-xs font-semibold text-brand-text">Alert Types</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-xs text-brand-text-sec cursor-pointer hover:text-brand-text transition-colors">
                <input type="checkbox" className="accent-brand-accent w-3 h-3" checked={alertTypes.buy} onChange={() => toggleAlertType("buy")} />
                BUY Signals
              </label>
              <label className="flex items-center gap-2 text-xs text-brand-text-sec cursor-pointer hover:text-brand-text transition-colors">
                <input type="checkbox" className="accent-brand-accent w-3 h-3" checked={alertTypes.sell} onChange={() => toggleAlertType("sell")} />
                SELL Signals
              </label>
              <label className="flex items-center gap-2 text-xs text-brand-text-sec cursor-pointer hover:text-brand-text transition-colors">
                <input type="checkbox" className="accent-brand-accent w-3 h-3" checked={alertTypes.scalping} onChange={() => toggleAlertType("scalping")} />
                Scalping
              </label>
              <label className="flex items-center gap-2 text-xs text-brand-text-sec cursor-pointer hover:text-brand-text transition-colors">
                <input type="checkbox" className="accent-brand-accent w-3 h-3" checked={alertTypes.intraday} onChange={() => toggleAlertType("intraday")} />
                Intraday
              </label>
            </div>
          </div>
        </div>
      </AccordionItem>

      <AccordionItem
        id="connections"
        title="Connections"
        icon={<Network className="w-4 h-4 text-brand-text-sec" />}
        isOpen={openSection === "connections"}
        onToggle={() => toggle("connections")}
      >
        <div className="space-y-3">
           <ConnectionRow label="TwelveData Feed" connected={true} />
           <ConnectionRow label="Yahoo Finance Fallback" connected={true} />
           <ConnectionRow label="Gemini AI Validator" connected={true} />
           <ConnectionRow label="Telegram Notifications" connected={true} />
           <ConnectionRow label="Firebase Datastore" connected={true} />
        </div>
      </AccordionItem>

      <AccordionItem
        id="session"
        title="Session Management"
        icon={<HardDrive className="w-4 h-4 text-brand-text-sec" />}
        isOpen={openSection === "session"}
        onToggle={() => toggle("session")}
      >
         <div className="space-y-4">
            <div className="p-3 bg-brand-bg-sec rounded text-xs space-y-2 border border-brand-border">
              <div className="flex justify-between"><span className="text-brand-text-sec">Current Device</span><span className="text-brand-text font-mono">Chrome / React</span></div>
              <div className="flex justify-between"><span className="text-brand-text-sec">Session ID</span><span className="text-brand-text font-mono text-[10px]">sess_9x#2v</span></div>
              <div className="flex justify-between"><span className="text-brand-text-sec">IP Info</span><span className="text-brand-text font-mono">192.168.1.1</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="p-2 border border-brand-border text-xs text-brand-text rounded hover:bg-brand-bg-sec">Logout Current</button>
              <button className="p-2 border border-brand-danger/30 text-xs text-brand-danger bg-brand-danger/10 hover:bg-brand-danger/20 rounded font-bold">Emergency Logout</button>
            </div>
         </div>
      </AccordionItem>

      <AccordionItem
        id="device"
        title="Device Management"
        icon={<Smartphone className="w-4 h-4 text-brand-text-sec" />}
        isOpen={openSection === "device"}
        onToggle={() => toggle("device")}
      >
         <div className="space-y-3">
            <div className="flex items-center justify-between p-2 border border-brand-success/30 bg-brand-success/5 rounded">
               <div className="flex flex-col">
                 <span className="text-xs font-bold text-brand-text">iPhone 14 Pro Max</span>
                 <span className="text-[10px] text-brand-text-sec">Active Now</span>
               </div>
               <Badge variant="success">CURRENT</Badge>
            </div>
            <div className="flex items-center justify-between p-2 border border-brand-border rounded">
               <div className="flex flex-col">
                 <span className="text-xs font-bold text-brand-text">Windows PC</span>
                 <span className="text-[10px] text-brand-text-sec">Last: 2 days ago</span>
               </div>
               <button className="text-[10px] text-brand-danger font-bold uppercase hover:underline">Remove</button>
            </div>
         </div>
      </AccordionItem>

      <h2 className="text-[15px] font-semibold text-[#DC2626] mt-4 mb-1 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]">
        <AlertTriangle className="w-4 h-4" />
        Emergency Tools
      </h2>
      <Card className="border-[#DC2626]/50 bg-[#DC2626]/5 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#DC2626] mb-1 tracking-tight">🚨 Emergency Rollback</h3>
          <p className="text-[10px] sm:text-xs text-brand-text-sec">
            Kembali ke versi sebelum AI edit terakhir. Dipake kalau app crash setelah AI commit.
          </p>
        </div>
        <button 
          onClick={handleRollback}
          disabled={rollbackLoading || rollbackDisabled}
          className="w-full bg-[#DC2626] text-white font-bold text-xs py-2.5 rounded-lg border border-[#DC2626] hover:bg-[#DC2626]/80 hover:shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center gap-2 uppercase tracking-wide"
        >
          {rollbackLoading ? (
             <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ROLLBACKING...
             </span>
          ) : (
            "ROLLBACK NOW"
          )}
        </button>
      </Card>
    </div>
  );
}

function AccordionItem({ id, title, icon, isOpen, onToggle, children }: any) {
  return (
    <Card className="p-0 overflow-hidden">
      <button 
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-sm font-semibold text-brand-text hover:bg-brand-bg-sec transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          {title}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-brand-text-sec transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      <div 
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-3 pt-0 border-t border-brand-border/50 mt-1">
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ConnectionRow({ label, connected }: { label: string, connected: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-brand-text-sec">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={cn("text-[10px] font-bold uppercase", connected ? "text-brand-success" : "text-brand-danger")}>
          {connected ? "Configured" : "Missing"}
        </span>
        <CheckCircle2 className={cn("w-3.5 h-3.5", connected ? "text-brand-success" : "text-brand-danger opacity-50")} />
      </div>
    </div>
  );
}
