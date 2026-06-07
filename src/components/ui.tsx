import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-brand-card border border-brand-border rounded-[16px] p-3 backdrop-blur-md flex flex-col gap-2", className)} {...props}>
      {props.children}
    </div>
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium text-brand-text-sec uppercase tracking-[0.08em]">{children}</div>;
}

export function Metric({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[22px] md:text-[28px] font-bold text-brand-text", className)}>{children}</div>;
}

export function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "danger" | "warning" | "info" | "accent" }) {
  const variants = {
    default: "bg-brand-bg-sec text-brand-text-sec border-brand-border",
    success: "bg-brand-success/10 text-brand-success border-brand-success/20",
    danger: "bg-brand-danger/10 text-brand-danger border-brand-danger/20",
    warning: "bg-brand-warning/10 text-brand-warning border-brand-warning/20",
    info: "bg-brand-info/10 text-brand-info border-brand-info/20",
    accent: "bg-brand-accent/10 text-brand-accent border-brand-accent/20",
  };
  return (
    <span className={cn("px-2 py-0.5 text-xs font-semibold rounded border", variants[variant])}>
      {children}
    </span>
  );
}
