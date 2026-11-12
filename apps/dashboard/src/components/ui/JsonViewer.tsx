"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { cn } from "@/lib/utils";

interface JsonViewerProps {
  data: unknown;
  title?: string;
  maxHeight?: string;
  defaultExpanded?: boolean;
}

export function JsonViewer({
  data,
  title,
  maxHeight = "400px",
  defaultExpanded = true,
}: JsonViewerProps) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const formatted = JSON.stringify(data, null, 2);

  if (data === undefined || data === null) {
    return (
      <div className="rounded-lg border border-[#292532] bg-[#14141B] p-3 text-xs font-mono text-zinc-500">
        null
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#292532] bg-[#0D0D12] select-none text-xs">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 font-mono text-zinc-400 hover:text-zinc-200"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{title || "Payload"}</span>
          <span className="text-[10px] text-zinc-500">
            ({typeof data === "object" ? Object.keys(data as object).length : 1} keys)
          </span>
        </button>

        <CopyButton value={formatted} label="Copy JSON" />
      </div>

      {!collapsed && (
        <pre
          style={{ maxHeight }}
          className="p-3 text-xs font-mono overflow-auto text-zinc-300 leading-relaxed scrollbar-thin whitespace-pre"
        >
          <code>{formatted}</code>
        </pre>
      )}
    </div>
  );
}
