"use client";

import React from "react";
import { Database, Code2, Server, Terminal, Layers, Box, Cpu, FileCode } from "lucide-react";

const TECH_ITEMS = [
  { label: "TypeScript First", icon: Code2, desc: "End-to-end typed SDK" },
  { label: "PostgreSQL Engine", icon: Database, desc: "ACID state persistence" },
  { label: "Node.js & Bun", icon: Server, desc: "High-throughput runtimes" },
  { label: "Self-Hosted", icon: Box, desc: "Full data sovereignty" },
  { label: "Developer SDK", icon: FileCode, desc: "@durable/sdk" },
  { label: "Transactional Outbox", icon: Layers, desc: "Guaranteed event delivery" },
  { label: "Open REST API", icon: Terminal, desc: "Full control plane" },
];

export function TechStrip() {
  return (
    <section className="border-y border-white/10 bg-[#0A0812]/80 py-10 relative overflow-hidden font-mono">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#706B80]">
            // BUILT FOR SYSTEMS THAT MUST KEEP RUNNING
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          {TECH_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="group p-3 bg-[#0D0B15] border border-white/10 hover:border-[#8B5CF6]/60 transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(139,92,246,0.15)] flex flex-col items-center text-center justify-between"
              >
                <Icon className="w-5 h-5 text-zinc-400 group-hover:text-[#A78BFA] transition-colors mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#F8F7FC] group-hover:text-white transition-colors truncate w-full">
                  {item.label}
                </span>
                <span className="text-[9px] text-[#706B80] group-hover:text-[#A6A1B5] transition-colors mt-0.5">
                  {item.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
