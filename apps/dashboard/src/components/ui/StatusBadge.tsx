import React from "react";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, className, size = "md" }: StatusBadgeProps) {
  const norm = status.toLowerCase();

  let dotColor = "bg-zinc-400";
  let textColor = "text-zinc-300";
  let bgBorder = "bg-[#14141B] border-[#292532]";

  if (norm === "running" || norm === "processing") {
    dotColor = "bg-[#8B5CF6] animate-pulse";
    textColor = "text-[#A78BFA]";
    bgBorder = "bg-[#1B1923] border-[#8B5CF6]/30";
  } else if (norm === "completed" || norm === "active" || norm === "success") {
    dotColor = "bg-[#22C55E]";
    textColor = "text-[#4ADE80]";
    bgBorder = "bg-[#142318] border-[#22C55E]/30";
  } else if (norm === "failed" || norm === "error" || norm === "timed_out") {
    dotColor = "bg-[#EF4444]";
    textColor = "text-[#F87171]";
    bgBorder = "bg-[#281416] border-[#EF4444]/30";
  } else if (norm === "cancelled" || norm === "paused" || norm === "inactive") {
    dotColor = "bg-[#F59E0B]";
    textColor = "text-[#FBBF24]";
    bgBorder = "bg-[#241E14] border-[#F59E0B]/30";
  } else if (norm === "pending" || norm === "waiting" || norm === "scheduled") {
    dotColor = "bg-[#A1A1AA]";
    textColor = "text-[#D4D4D8]";
    bgBorder = "bg-[#1A1A22] border-[#292532]";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono uppercase tracking-wider font-medium border rounded-md select-none",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        bgBorder,
        textColor,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
