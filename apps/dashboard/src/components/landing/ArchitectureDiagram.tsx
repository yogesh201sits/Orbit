"use client";

import React, { useState } from "react";
import { Terminal, Database, Server, Cpu, Layers, GitBranch, ArrowDown, Activity, ShieldCheck } from "lucide-react";

export function ArchitectureDiagram() {
  const [activeLayer, setActiveLayer] = useState<string>("engine");

  return (
    <section id="architecture" className="py-24 sm:py-32 relative bg-[#08070D] font-mono border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#A78BFA]">
            // SYSTEM TOPOLOGY
          </span>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-[#F8F7FC] font-sans">
            Designed for <br />
            <span className="text-[#8B5CF6]">reliable execution.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#A6A1B5] font-sans">
            Orbit splits execution into decoupled layers: lightweight SDK clients, a durable execution engine, persistent PostgreSQL tables, and distributed worker fleets.
          </p>
        </div>

        {/* Interactive Architecture Canvas */}
        <div className="max-w-4xl mx-auto border-2 border-white/15 bg-[#0D0B15] p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
          <div className="space-y-6">
            {/* Layer 1: Application Layer */}
            <div
              onClick={() => setActiveLayer("app")}
              className={`p-4 border-2 cursor-pointer transition-all ${
                activeLayer === "app"
                  ? "bg-[#141020] border-[#8B5CF6] shadow-[3px_3px_0px_#8B5CF6]"
                  : "bg-black/60 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-[#8B5CF6]" />
                  <div>
                    <span className="text-xs font-black uppercase text-white tracking-wider block">
                      Application & Client Layer
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Your existing Next.js, Node.js, or microservice applications
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] bg-black border border-white/15 text-[#A78BFA] font-bold">
                  LAYER 01
                </span>
              </div>
            </div>

            {/* Down Connector */}
            <div className="flex justify-center -my-3">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-black border border-white/10 text-[10px] text-zinc-400">
                <ArrowDown className="w-3 h-3 text-[#8B5CF6]" />
                <span>@durable/sdk &amp; HTTP REST API (orb_live_*)</span>
              </div>
            </div>

            {/* Layer 2: Core Execution Engine */}
            <div
              onClick={() => setActiveLayer("engine")}
              className={`p-5 border-2 cursor-pointer transition-all ${
                activeLayer === "engine"
                  ? "bg-[#171326] border-[#8B5CF6] shadow-[4px_4px_0px_#8B5CF6]"
                  : "bg-black/60 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-[#A78BFA]" />
                  <div>
                    <span className="text-xs font-black uppercase text-white tracking-wider block">
                      Orbit Durable Engine (@durable/engine)
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Coordinates deterministic execution, lease recovery, and transactional step state
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] bg-[#8B5CF6] text-white font-bold">
                  CORE ENGINE
                </span>
              </div>

              {/* Engine Sub-components */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-black/60 border border-white/10">
                  <span className="text-[10px] text-[#A78BFA] font-bold uppercase block">01. Step Executor</span>
                  <span className="text-white font-bold mt-1 block">Deterministic ID allocation</span>
                </div>
                <div className="p-3 bg-black/60 border border-white/10">
                  <span className="text-[10px] text-[#A78BFA] font-bold uppercase block">02. Lease Fencing</span>
                  <span className="text-white font-bold mt-1 block">Crash detection & recovery</span>
                </div>
                <div className="p-3 bg-black/60 border border-white/10">
                  <span className="text-[10px] text-[#A78BFA] font-bold uppercase block">03. Event Sequencer</span>
                  <span className="text-white font-bold mt-1 block">Strict outbox order</span>
                </div>
              </div>
            </div>

            {/* Down Connector */}
            <div className="flex justify-center -my-3">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-black border border-white/10 text-[10px] text-zinc-400">
                <ArrowDown className="w-3 h-3 text-emerald-400" />
                <span>ACID Transactions (PostgreSQL)</span>
              </div>
            </div>

            {/* Layer 3: Persistence Layer */}
            <div
              onClick={() => setActiveLayer("storage")}
              className={`p-4 border-2 cursor-pointer transition-all ${
                activeLayer === "storage"
                  ? "bg-[#141020] border-emerald-500 shadow-[3px_3px_0px_#10B981]"
                  : "bg-black/60 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="text-xs font-black uppercase text-white tracking-wider block">
                      PostgreSQL Persistence Layer (@durable/storage)
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Standard relational tables: workflow_runs, workflow_steps, workflow_events, outbox_events, jobs
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 font-bold">
                  PERSISTENCE
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="px-2 py-1 bg-black border border-white/10 text-zinc-300">workflow_runs (UUID)</span>
                <span className="px-2 py-1 bg-black border border-white/10 text-zinc-300">workflow_steps (JSONB)</span>
                <span className="px-2 py-1 bg-black border border-white/10 text-zinc-300">job_leases (atomic lock)</span>
                <span className="px-2 py-1 bg-black border border-white/10 text-zinc-300">outbox_events (ordered)</span>
              </div>
            </div>

            {/* Layer 4: Distributed Worker Fleet */}
            <div
              onClick={() => setActiveLayer("workers")}
              className={`p-4 border-2 cursor-pointer transition-all ${
                activeLayer === "workers"
                  ? "bg-[#141020] border-[#8B5CF6] shadow-[3px_3px_0px_#8B5CF6]"
                  : "bg-black/60 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-[#8B5CF6]" />
                  <div>
                    <span className="text-xs font-black uppercase text-white tracking-wider block">
                      Distributed Worker Fleet (@durable/worker)
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Horizontal scaling daemon workers with heartbeat reporting and job queue pulling
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] bg-black border border-white/15 text-[#A78BFA] font-bold">
                  EXECUTORS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
