import React, { useState, useEffect } from "react";
import { Activity, Radio, BarChart3, Settings as SettingsIcon, ShieldAlert, Cpu, Terminal, AlertTriangle, MessageSquare } from "lucide-react";
import { cn } from "./ui";
import { Dashboard } from "./Dashboard";
import { Scanner } from "./Scanner";
import { Signals } from "./Signals";
import { Analytics } from "./Analytics";
import { Settings } from "./Settings";
import { Errors } from "./Errors";
import { AIChat } from "./AIChat";
import { apiFetch } from "../lib/api";

export function Layout() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [hasErrors, setHasErrors] = useState(false);

  useEffect(() => {
    const handleAskAi = () => {
      setActiveTab("ai");
    };
    window.addEventListener("ask-ai", handleAskAi);
    
    const checkErrors = async () => {
      try {
        const { data } = await apiFetch("/system/status");
        if (data?.errors && data.errors.length > 0) {
          setHasErrors(true);
        } else {
          setHasErrors(false);
        }
      } catch (err) {
        // Silently handle error fetching status for header
      }
    };
    checkErrors();
    const iv = setInterval(checkErrors, 5000);
    return () => {
      clearInterval(iv);
      window.removeEventListener("ask-ai", handleAskAi);
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": return <Dashboard />;
      case "scanner": return <Scanner />;
      case "signals": return <Signals />;
      case "analytics": return <Analytics />;
      case "ai": return <AIChat />;
      case "settings": return <Settings />;
      case "logs": return <Errors />;
      default: return <div className="p-4 text-brand-text-sec">Work in progress: {activeTab}</div>;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-brand-bg flex flex-col font-sans pb-[72px]">
      <header className="h-14 shrink-0 sticky top-0 z-50 bg-brand-bg-sec/80 backdrop-blur-xl border-b border-brand-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#00FF94] to-[#00BFFF] flex items-center justify-center shadow-lg shadow-[#00BFFF]/20">
            <Cpu className="w-5 h-5 text-brand-bg font-black" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight uppercase text-brand-text leading-tight">XAUUSD SYSTEM</h1>
            <div className="text-[10px] text-[#00FF94] font-medium tracking-[0.1em] uppercase flex items-center gap-1 leading-tight">
              Institutional Core
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {hasErrors && (
            <button 
              onClick={() => setActiveTab("logs")}
              className="flex items-center gap-1.5 bg-brand-danger/10 border border-brand-danger/30 px-2 py-1 rounded-md cursor-pointer hover:bg-brand-danger/20 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-brand-danger animate-pulse"></div>
              <span className="text-[10px] font-bold tracking-wide text-brand-danger uppercase">Errors</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 bg-brand-card border border-brand-border px-3 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-brand-success shadow-[0_0_8px_#00FF94] animate-pulse"></div>
            <span className="text-[11px] font-bold tracking-wide text-brand-text tabular-nums">ONLINE</span>
          </div>
          <div className="h-8 w-px bg-brand-border hidden sm:block"></div>
          <div className="text-right tabular-nums">
            <p className="text-[11px] font-bold text-brand-text font-mono">{new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar" })} WITA</p>
            <p className="text-[9px] text-brand-text-sec font-semibold uppercase tracking-wider">{new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Makassar" })}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {renderContent()}
      </main>

      <nav className="fixed bottom-0 w-full bg-brand-bg-sec/90 backdrop-blur-xl border-t border-brand-border px-2 py-2 flex justify-around items-center z-50 pb-safe">
        <NavItem active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<Activity />} label="Dash" />
        <NavItem active={activeTab === "scanner"} onClick={() => setActiveTab("scanner")} icon={<Radio />} label="Scan" />
        <NavItem active={activeTab === "signals"} onClick={() => setActiveTab("signals")} icon={<ShieldAlert />} label="Signals" />
        <NavItem active={activeTab === "ai"} onClick={() => setActiveTab("ai")} icon={<MessageSquare />} label="AI" />
        <NavItem active={activeTab === "logs"} onClick={() => setActiveTab("logs")} icon={<AlertTriangle />} label="Errors" />
        <NavItem active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<SettingsIcon />} label="Config" />
      </nav>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[64px] relative",
        active ? "text-brand-accent" : "text-brand-text-sec hover:text-brand-text"
      )}
    >
      <div className={cn("w-5 h-5", active && "drop-shadow-[0_0_8px_rgba(0,191,255,0.5)]")}>
        {React.cloneElement(icon as React.ReactElement, { strokeWidth: active ? 2.5 : 2 })}
      </div>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
