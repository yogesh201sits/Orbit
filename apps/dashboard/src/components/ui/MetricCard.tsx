import React from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  highlight?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  trend,
  icon,
  highlight,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#292532] bg-[#14141B] p-4 flex flex-col justify-between transition-colors",
        highlight && "border-[#8B5CF6]/40 shadow-[0_0_12px_rgba(139,92,246,0.15)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#A1A1AA] uppercase tracking-wider">{label}</span>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tracking-tight text-[#F5F3FF]">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-mono font-medium",
              trend.isPositive ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtext && (
        <div className="mt-1.5 text-xs text-zinc-500 font-mono truncate">{subtext}</div>
      )}
    </div>
  );
}
