import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { Card, Badge, cn } from "./ui";
import { ShieldCheck } from "lucide-react";

export function Signals() {
  const [signals, setSignals] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/signals").then(res => {
      if (res.data) setSignals(res.data);
    });
  }, []);

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="text-[15px] font-semibold text-brand-text mb-2">Signal History</h2>
      {signals.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-6 text-brand-text-sec">
            <ShieldCheck className="w-8 h-8 mb-2 opacity-50" />
            <div className="text-sm font-medium">No signals recorded yet.</div>
          </div>
        </Card>
      ) : (
        signals.map(s => (
          <Card key={s.id} className={cn(
            "border-l-4 p-3",
            s.type === "BUY" ? "border-l-brand-success" : "border-l-brand-danger"
          )}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <Badge variant={s.type === "BUY" ? "success" : "danger"}>{s.type}</Badge>
                <span className="text-sm font-bold">{s.symbol}</span>
              </div>
              <span className="text-[10px] text-brand-text-sec">
                {new Date(s.timestamp).toLocaleString("id-ID", { timeZone: "Asia/Makassar" })}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
               <div className="text-xs text-brand-text-sec">Entry: <span className="font-mono text-brand-text">{s.entry.toFixed(2)}</span></div>
               <div className="text-xs text-brand-text-sec">AI: <span className="text-brand-accent">{s.ai_verdict}</span></div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
