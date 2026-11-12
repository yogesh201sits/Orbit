"use client";

import React, { useState } from "react";
import { AlertOctagon, CheckCircle2, RotateCw, XCircle, Zap, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";

export function ProblemSolution() {
  const [simulatedCrash, setSimulatedCrash] = useState(true);

  return (
    <section className="py-24 sm:py-32 relative bg-[#08070D] overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-radial-center-glow opacity-60 pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#A78BFA]">
            // ARCHITECTURAL PARADIGM
          </span>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-[#F8F7FC] font-sans">
            Failures happen. <br />
            <span className="text-[#8B5CF6]">Losing progress shouldn&apos;t.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#A6A1B5] font-sans">
            Standard task queues and background functions drop volatile in-memory state on process restarts, deployment rollouts, and network timeouts. Orbit checkpoints every step directly into PostgreSQL.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setSimulatedCrash(!simulatedCrash)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#141020] hover:bg-[#1D1730] border-2 border-[#8B5CF6] text-xs font-mono font-bold uppercase text-white shadow-[2px_2px_0px_#8B5CF6] active:translate-y-0.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#A78BFA]" />
              <span>Simulate Crash: {simulatedCrash ? "ACTIVE" : "OFF"} (Click to Toggle)</span>
            </button>
          </div>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 font-mono">
          {/* LEFT: Traditional Execution */}
          <div className="border-2 border-red-500/40 bg-[#0F070B] p-6 sm:p-8 flex flex-col justify-between shadow-[0_10px_30px_rgba(239,68,68,0.1)] relative">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-red-500/20">
                <div>
                  <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">
                    LEGACY EXECUTION ARCHITECTURE
                  </span>
                  <h3 className="text-lg font-black uppercase text-white mt-1">
                    Volatile Task Queues & Cron
                  </h3>
                </div>
                <XCircle className="w-6 h-6 text-red-500 shrink-0" />
              </div>

              {/* Timeline Steps */}
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3 p-3 bg-black/60 border border-white/10">
                  <span className="text-zinc-500">01</span>
                  <div>
                    <span className="font-bold text-white uppercase block">Workflow Triggered</span>
                    <span className="text-[11px] text-zinc-400">Memory initialized on worker process</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto shrink-0" />
                </div>

                <div className="flex items-start gap-3 p-3 bg-black/60 border border-white/10">
                  <span className="text-zinc-500">02</span>
                  <div>
                    <span className="font-bold text-white uppercase block">Payment Charged ($150.00)</span>
                    <span className="text-[11px] text-zinc-400">Third-party API debit succeeds</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto shrink-0" />
                </div>

                {/* Simulated Failure Point */}
                <div className={`flex items-start gap-3 p-3 border ${
                  simulatedCrash ? "bg-red-950/40 border-red-500 text-red-200" : "bg-black/60 border-white/10"
                }`}>
                  <span className="text-red-400 font-bold">03</span>
                  <div>
                    <span className="font-bold uppercase text-red-400 block">
                      Worker SIGKILL / Kubernetes Pod Evicted
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Process killed midway. In-memory stack and variables wiped.
                    </span>
                  </div>
                  <AlertOctagon className="w-4 h-4 text-red-500 ml-auto shrink-0 animate-pulse" />
                </div>

                {/* Negative Consequence */}
                <div className="flex items-start gap-3 p-3 bg-red-950/60 border border-red-500/50 text-red-300">
                  <span className="text-red-400 font-black">!</span>
                  <div>
                    <span className="font-black uppercase block">State Lost Permanently</span>
                    <span className="text-[11px] text-red-200 leading-relaxed block mt-0.5">
                      Restarting from beginning double-charges customer. Leaving it drops order fulfillment. Requires high-stress manual database surgery.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-red-500/20 text-[11px] text-red-400 uppercase font-bold flex items-center justify-between">
              <span>OUTCOME: BROKEN DATA STATE</span>
              <span>MANUAL ESCALATION</span>
            </div>
          </div>

          {/* RIGHT: Orbit Durable Execution */}
          <div className="border-2 border-[#8B5CF6] bg-[#0E0A1A] p-6 sm:p-8 flex flex-col justify-between shadow-[0_10px_30px_rgba(139,92,246,0.2)] relative">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#8B5CF6]/30">
                <div>
                  <span className="text-[10px] text-[#A78BFA] font-bold uppercase tracking-wider block">
                    ORBIT DURABLE EXECUTION ENGINE
                  </span>
                  <h3 className="text-lg font-black uppercase text-white mt-1">
                    Function-First Durable Code
                  </h3>
                </div>
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              </div>

              {/* Timeline Steps */}
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3 p-3 bg-black/60 border border-white/10">
                  <span className="text-[#8B5CF6] font-bold">01</span>
                  <div>
                    <span className="font-bold text-white uppercase block">Workflow Triggered</span>
                    <span className="text-[11px] text-zinc-400">Persisted with UUID and idempotency key in PostgreSQL</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto shrink-0" />
                </div>

                <div className="flex items-start gap-3 p-3 bg-black/60 border border-white/10">
                  <span className="text-[#8B5CF6] font-bold">02</span>
                  <div>
                    <span className="font-bold text-white uppercase block">Step Checkpoint: &apos;charge-payment&apos;</span>
                    <span className="text-[11px] text-zinc-400">Payment output committed transactionally to step table</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto shrink-0" />
                </div>

                {/* Crash Handled Gracefully */}
                <div className="flex items-start gap-3 p-3 bg-[#171326] border border-[#8B5CF6]">
                  <span className="text-[#A78BFA] font-bold">03</span>
                  <div>
                    <span className="font-bold uppercase text-[#C4B5FD] block">
                      Pod Crash Detected & Fenced
                    </span>
                    <span className="text-[11px] text-zinc-300">
                      Heartbeat timeout expires. Secondary worker claims execution lease safely.
                    </span>
                  </div>
                  <RotateCw className="w-4 h-4 text-[#A78BFA] ml-auto shrink-0 animate-spin" />
                </div>

                {/* Positive Resumed Step */}
                <div className="flex items-start gap-3 p-3 bg-emerald-950/40 border border-emerald-500/60 text-emerald-300">
                  <span className="text-emerald-400 font-black">✓</span>
                  <div>
                    <span className="font-black uppercase block">Resumes at Step 3: &apos;update-inventory&apos;</span>
                    <span className="text-[11px] text-emerald-200 leading-relaxed block mt-0.5">
                      Step 2 output replayed from database without re-executing payment. All subsequent steps continue to completion.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[#8B5CF6]/30 text-[11px] text-emerald-400 uppercase font-bold flex items-center justify-between">
              <span>OUTCOME: 100% RELIABLE EXECUTION</span>
              <span>ZERO DATA LOSS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
