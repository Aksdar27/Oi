import { Card, Metric, CardLabel } from "./ui";

export function Analytics() {
  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="text-[15px] font-semibold text-brand-text mb-2">Performance Analytics</h2>
      
      <div className="grid grid-cols-2 gap-3">
        <Card className="h-[100px] justify-between">
          <CardLabel>Win Rate</CardLabel>
          <Metric className="text-brand-success">--%</Metric>
        </Card>
        <Card className="h-[100px] justify-between">
          <CardLabel>Loss Rate</CardLabel>
          <Metric className="text-brand-danger">--%</Metric>
        </Card>
        
        <Card className="h-[100px] justify-between">
          <CardLabel>Avg RR</CardLabel>
          <Metric className="text-brand-text">1:--</Metric>
        </Card>
        <Card className="h-[100px] justify-between">
          <CardLabel>Total Signals</CardLabel>
          <Metric className="text-brand-info">0</Metric>
        </Card>

        <Card className="h-[100px] justify-between">
          <CardLabel>AI Acceptance</CardLabel>
          <Metric className="text-brand-accent">--%</Metric>
        </Card>
        <Card className="h-[100px] justify-between">
          <CardLabel>System Uptime</CardLabel>
          <Metric className="text-brand-text">99.9%</Metric>
        </Card>
      </div>
    </div>
  );
}
