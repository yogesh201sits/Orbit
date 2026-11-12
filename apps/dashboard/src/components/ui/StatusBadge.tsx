import React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, className, size = "md" }: StatusBadgeProps) {
  const norm = status.toLowerCase();

  let dotColor = "bg-zinc-500";
  let textColor = "text-zinc-300";
  let bgBorder = "bg-black border-2 border-zinc-700";

  if (norm === "running" || norm === "processing") {
    dotColor = "bg-[#8B5CF6] animate-pulse";
    textColor = "text-white font-bold";
    bgBorder = "bg-[#120D22] border-2 border-[#8B5CF6] shadow-[2px_2px_0px_#8B5CF6]";
  } else if (norm === "completed" || norm === "active" || norm === "success") {
    dotColor = "bg-white";
    textColor = "text-white font-bold";
    bgBorder = "bg-black border-2 border-white shadow-[2px_2px_0px_#FFFFFF]";
  } else if (norm === "failed" || norm === "error" || norm === "timed_out") {
    dotColor = "bg-[#A78BFA]";
    textColor = "text-[#A78BFA] font-bold";
    bgBorder = "bg-black border-2 border-[#8B5CF6] shadow-[2px_2px_0px_#8B5CF6]";
  } else if (norm === "cancelled" || norm === "paused" || norm === "inactive") {
    dotColor = "bg-zinc-500";
    textColor = "text-zinc-400 font-bold";
    bgBorder = "bg-black border-2 border-zinc-800";
  } else if (norm === "pending" || norm === "waiting" || norm === "scheduled") {
    dotColor = "bg-zinc-400";
    textColor = "text-zinc-300 font-medium";
    bgBorder = "bg-[#0A0A0F] border-2 border-zinc-700";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono uppercase tracking-widest select-none rounded-none",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        bgBorder,
        textColor,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 shrink-0 rounded-none", dotColor)} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
