"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Terminal } from "lucide-react";
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
      <div className="rounded-none border-2 border-[#2D273D] bg-black p-3 text-xs font-mono text-zinc-500">
        // null
      </div>
    );
  }

  return (
    <div className="rounded-none border-2 border-[#2D273D] bg-black overflow-hidden flex flex-col shadow-[3px_3px_0px_#000000]">
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-[#2D273D] bg-[#0A0A0F] select-none text-xs">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 font-mono font-bold uppercase tracking-wider text-white hover:text-[#A78BFA]"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-[#8B5CF6]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#8B5CF6]" />}
          <span>{title || "PAYLOAD"}</span>
          <span className="text-[10px] text-zinc-400 font-normal">
            [{typeof data === "object" ? Object.keys(data as object).length : 1} keys]
          </span>
        </button>

        <CopyButton value={formatted} label="COPY" />
      </div>

      {!collapsed && (
        <pre
          style={{ maxHeight }}
          className="p-3 text-xs font-mono overflow-auto text-zinc-200 leading-relaxed scrollbar-thin whitespace-pre bg-black"
        >
          <code>{formatted}</code>
        </pre>
      )}
    </div>
  );
}
