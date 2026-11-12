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
        "rounded-none border-2 bg-[#0A0A0F] p-4 flex flex-col justify-between transition-transform",
        highlight
          ? "border-[#8B5CF6] shadow-[4px_4px_0px_#8B5CF6] bg-[#0E0A1A]"
          : "border-[#2D273D] shadow-[3px_3px_0px_#000000] hover:border-[#8B5CF6]/60",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#2D273D]/80 pb-2">
        <span className="text-[11px] font-mono font-bold text-[#A1A1AA] uppercase tracking-widest">
          {label}
        </span>
        {icon && <div className="text-[#8B5CF6]">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-black tracking-tight text-white">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-mono font-bold tracking-wider",
              trend.isPositive ? "text-white" : "text-zinc-500"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtext && (
        <div className="mt-2 text-[10px] text-zinc-400 font-mono tracking-wider uppercase border-t border-[#2D273D]/60 pt-1.5 truncate">
          // {subtext}
        </div>
      )}
    </div>
  );
}
