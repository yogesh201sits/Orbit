"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  RotateCw,
  GitBranch,
  Database,
  CalendarClock,
  Activity,
  Layers,
  Terminal,
  Clock,
  ArrowRight,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export function FeaturesBento() {
  const [activeBackoffAttempt, setActiveBackoffAttempt] = useState(2);

  return (
    <section id="capabilities" className="py-24 sm:py-32 relative bg-[#08070D] font-mono">
      {/* Background glow and subtle dot grid */}
      <div
        className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-radial-purple-glow opacity-50 pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#A78BFA]">
            // CORE INFRASTRUCTURE CAPABILITIES
          </span>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-[#F8F7FC] font-sans">
            Everything your workflows <br />
            <span className="text-[#8B5CF6]">need to keep moving.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#A6A1B5] font-sans">
            Purpose-built primitives designed to replace brittle ad-hoc cron jobs, manual retries, and lost in-memory async promises.
          </p>
        </div>

        {/* Asymmetrical Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Durable Execution (Large 2-col on LG) */}
          <div className="lg:col-span-2 border-2 border-white/10 bg-[#0D0B15] p-6 sm:p-8 flex flex-col justify-between hover:border-[#8B5CF6]/60 transition-all shadow-[4px_4px_0px_#000000] relative overflow-hidden group">
            <div className="space-y-4 relative z-10">
              <div className="w-10 h-10 bg-[#141020] border border-[#8B5CF6]/50 flex items-center justify-center text-[#A78BFA]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-wide">
                Durable Execution
              </h3>
              <p className="text-xs sm:text-sm text-[#A6A1B5] leading-relaxed max-w-xl font-sans">
                Persist workflow progress so completed work doesn&apos;t need to start over. If a server restarts or a deployment rolls out mid-execution, Orbit restores state exactly at the interrupted step.
              </p>
            </div>

            {/* Visual: Simulated Restart & Retention Timeline */}
            <div className="mt-8 pt-6 border-t border-white/10 relative z-10">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
                <span className="font-bold text-white uppercase">// CHECKPOINT RETENTION GRAPH</span>
                <span className="text-emerald-400 font-bold">STATE PRESERVED</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-3 bg-black/60 border border-emerald-500/40 text-emerald-300">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">STEP 01</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-1">charge_card</span>
                  <span className="text-[9px] text-emerald-400 font-mono block mt-1">Saved (output committed)</span>
                </div>
                <div className="p-3 bg-black/60 border border-yellow-500/40 text-yellow-300">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">SIGKILL</span>
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-1">process_crash</span>
                  <span className="text-[9px] text-yellow-400 font-mono block mt-1">Lease auto-recovered</span>
                </div>
                <div className="p-3 bg-[#141020] border-2 border-[#8B5CF6] text-[#A78BFA]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">STEP 02</span>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  </div>
                  <span className="text-[10px] text-zinc-300 block mt-1">send_webhook</span>
                  <span className="text-[9px] text-white font-mono block mt-1">Resumed instantly</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Automatic Retries (Interactive backoff curves) */}
          <div className="border-2 border-white/10 bg-[#0D0B15] p-6 sm:p-8 flex flex-col justify-between hover:border-[#8B5CF6]/60 transition-all shadow-[4px_4px_0px_#000000] relative group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-[#141020] border border-[#8B5CF6]/50 flex items-center justify-center text-[#A78BFA]">
                <RotateCw className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black uppercase text-white tracking-wide">
                Automatic Retries
              </h3>
              <p className="text-xs sm:text-sm text-[#A6A1B5] leading-relaxed font-sans">
                Recover from transient failures with configurable retry strategies and jittered exponential backoff.
              </p>
            </div>

            {/* Visual: Exponential Backoff Timing Visualization */}
            <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>BACKOFF ATTEMPT:</span>
                <div className="flex gap-1">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setActiveBackoffAttempt(num)}
                      className={`px-2 py-0.5 text-[10px] font-bold border ${
                        activeBackoffAttempt === num
                          ? "bg-[#8B5CF6] text-white border-white"
                          : "bg-black text-zinc-500 border-white/10"
                      }`}
                    >
                      #{num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-black/60 border border-white/10 text-xs space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">DELAY:</span>
                  <span className="text-white font-bold">
                    {activeBackoffAttempt === 1 ? "1,000ms" : activeBackoffAttempt === 2 ? "4,000ms" : "16,000ms"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">FORMULA:</span>
                  <span className="text-[#A78BFA] font-bold">min(maxDelay, base * 2^attempt)</span>
                </div>
                <div className="w-full bg-[#141020] h-2 rounded-none overflow-hidden mt-2">
                  <div
                    className="bg-[#8B5CF6] h-full transition-all duration-300"
                    style={{ width: `${(activeBackoffAttempt / 3) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Step-Based Workflows */}
          <div className="border-2 border-white/10 bg-[#0D0B15] p-6 sm:p-8 flex flex-col justify-between hover:border-[#8B5CF6]/60 transition-all shadow-[4px_4px_0px_#000000] relative group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-[#141020] border border-[#8B5CF6]/50 flex items-center justify-center text-[#A78BFA]">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black uppercase text-white tracking-wide">
                Step-Based Workflows
              </h3>
              <p className="text-xs sm:text-sm text-[#A6A1B5] leading-relaxed font-sans">
                Break complex processes into manageable, independently tracked steps. Individual steps are isolated, cached, and deterministic.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="p-3 bg-black/70 border border-white/10 text-[11px] space-y-2">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-white font-bold">step.run(&quot;verify&quot;)</span>
                  <span className="text-emerald-400">CACHED</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-white font-bold">step.sleep(&quot;delay&quot;, &quot;1h&quot;)</span>
                  <span className="text-[#A78BFA]">SUSPENDED</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-white font-bold">step.emit(&quot;order.done&quot;)</span>
                  <span className="text-zinc-500">QUEUED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Recovery and Persistence */}
          <div className="border-2 border-white/10 bg-[#0D0B15] p-6 sm:p-8 flex flex-col justify-between hover:border-[#8B5CF6]/60 transition-all shadow-[4px_4px_0px_#000000] relative group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-[#141020] border border-[#8B5CF6]/50 flex items-center justify-center text-[#A78BFA]">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black uppercase text-white tracking-wide">
                Recovery & Persistence
              </h3>
              <p className="text-xs sm:text-sm text-[#A6A1B5] leading-relaxed font-sans">
                Maintain execution state and recover interrupted workflow runs through distributed leases and transactional outboxes.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="p-3 bg-black border border-white/10 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">LEASE FENCING:</span>
                  <span className="text-emerald-400 font-bold">STRICT ATOMIC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">STORAGE BACKEND:</span>
                  <span className="text-white font-bold">POSTGRESQL ACID</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">CRASH RECOVERY:</span>
                  <span className="text-[#A78BFA] font-bold">&lt; 200MS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Scheduling */}
          <div className="border-2 border-white/10 bg-[#0D0B15] p-6 sm:p-8 flex flex-col justify-between hover:border-[#8B5CF6]/60 transition-all shadow-[4px_4px_0px_#000000] relative group">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-[#141020] border border-[#8B5CF6]/50 flex items-center justify-center text-[#A78BFA]">
                <CalendarClock className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black uppercase text-white tracking-wide">
                Scheduling
              </h3>
              <p className="text-xs sm:text-sm text-[#A6A1B5] leading-relaxed font-sans">
                Run workflows according to your scheduling requirements. Native cron patterns, delay timers, and catch-up policies built in.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="p-3 bg-black border border-white/10 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">CRON SYNTAX:</span>
                  <span className="text-[#C4B5FD] font-mono">0 0 * * *</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">MISSED EXECUTION:</span>
                  <span className="text-white font-bold">CATCH_UP / SKIP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">DISPATCH RESOLUTION:</span>
                  <span className="text-emerald-400 font-bold">SUB-SECOND</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 6: Execution Visibility (Large 3-col or full width on LG) */}
          <div className="lg:col-span-3 border-2 border-white/10 bg-[#0D0B15] p-6 sm:p-8 flex flex-col justify-between hover:border-[#8B5CF6]/60 transition-all shadow-[4px_4px_0px_#000000] relative group">
            <div className="space-y-4 max-w-2xl">
              <div className="w-10 h-10 bg-[#141020] border border-[#8B5CF6]/50 flex items-center justify-center text-[#A78BFA]">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white tracking-wide">
                Execution Visibility
              </h3>
              <p className="text-xs sm:text-sm text-[#A6A1B5] leading-relaxed font-sans">
                Understand workflow progress, step execution history, inputs, outputs, error stacks, and audit logs with microsecond precision.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-black border border-white/10">
                  <span className="text-zinc-500 text-[10px] uppercase block">Audit Trails</span>
                  <span className="text-white font-bold text-sm mt-0.5 block">100% Deterministic</span>
                </div>
                <div className="p-3 bg-black border border-white/10">
                  <span className="text-zinc-500 text-[10px] uppercase block">Step History</span>
                  <span className="text-emerald-400 font-bold text-sm mt-0.5 block">Immutable Events</span>
                </div>
                <div className="p-3 bg-black border border-white/10">
                  <span className="text-zinc-500 text-[10px] uppercase block">Error Captures</span>
                  <span className="text-red-400 font-bold text-sm mt-0.5 block">Full Stack Traces</span>
                </div>
                <div className="p-3 bg-black border border-white/10">
                  <span className="text-zinc-500 text-[10px] uppercase block">Metrics & Alerts</span>
                  <span className="text-[#A78BFA] font-bold text-sm mt-0.5 block">Real-time Telemetry</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
