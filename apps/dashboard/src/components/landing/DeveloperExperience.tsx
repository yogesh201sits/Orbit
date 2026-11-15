"use client";

import React from "react";
import { Terminal, Shield, Cpu, Code2, KeyRound, Server, Check } from "lucide-react";

export function DeveloperExperience() {
  return (
    <section className="py-24 sm:py-32 relative bg-[#0D0B15]/40 backdrop-blur-[1px] font-mono border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#A78BFA]">
            // DEVELOPER EXPERIENCE
          </span>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-[#F8F7FC] font-sans">
            Your code. <br />
            <span className="text-[#8B5CF6]">Your infrastructure. Your control.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#A6A1B5] font-sans">
            Orbit is built for engineers who value type safety, transparent architecture, and infrastructure they can run on their own terms.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: TypeScript SDK Guarantee */}
          <div className="border-2 border-white/10 bg-[#08070D] p-6 sm:p-8 flex flex-col justify-between hover:border-[#8B5CF6]/50 transition-all shadow-[4px_4px_0px_#000000]">
            <div className="space-y-4">
              <div className="w-9 h-9 bg-[#141020] border border-[#8B5CF6]/40 flex items-center justify-center text-[#A78BFA]">
                <Code2 className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-black uppercase text-white">SDK-First Workflows</h3>
              <p className="text-xs text-[#A6A1B5] font-sans leading-relaxed">
                Define steps with standard JavaScript and TypeScript functions. Automatic input and output inference through Zod schemas. Zero complex boilerplate.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-xs">
              <div className="bg-black/80 p-3 border border-white/10 text-[11px] space-y-1 text-zinc-300">
                <div><span className="text-[#8B5CF6]">const</span> run = <span className="text-[#A78BFA]">await</span> orbit.runs.create(</div>
                <div className="pl-4">&quot;order-fulfillment&quot;,</div>
                <div className="pl-4">&#123; input: &#123; customerId: &quot;c_99&quot; &#125; &#125;</div>
                <div>);</div>
              </div>
            </div>
          </div>

          {/* Card 2: Programmatic API Control */}
          <div className="border-2 border-white/10 bg-[#08070D] p-6 sm:p-8 flex flex-col justify-between hover:border-[#8B5CF6]/50 transition-all shadow-[4px_4px_0px_#000000]">
            <div className="space-y-4">
              <div className="w-9 h-9 bg-[#141020] border border-[#8B5CF6]/40 flex items-center justify-center text-[#A78BFA]">
                <Terminal className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-black uppercase text-white">API-Driven Management</h3>
              <p className="text-xs text-[#A6A1B5] font-sans leading-relaxed">
                Every workflow, run, step, event, and schedule is addressable via clean OpenAPI REST routes with full pagination and idempotency protection.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-xs">
              <div className="bg-black/80 p-3 border border-white/10 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-emerald-400 font-bold">GET</span>
                  <span className="text-white">/v1/workflows</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-purple-400 font-bold">POST</span>
                  <span className="text-white">/v1/workflows/:id/runs</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-yellow-400 font-bold">POST</span>
                  <span className="text-white">/v1/runs/:id/retry</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Self-Hosted Freedom */}
          <div className="border-2 border-white/10 bg-[#08070D] p-6 sm:p-8 flex flex-col justify-between hover:border-[#8B5CF6]/50 transition-all shadow-[4px_4px_0px_#000000]">
            <div className="space-y-4">
              <div className="w-9 h-9 bg-[#141020] border border-[#8B5CF6]/40 flex items-center justify-center text-[#A78BFA]">
                <Server className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-black uppercase text-white">Self-Hosted Infrastructure</h3>
              <p className="text-xs text-[#A6A1B5] font-sans leading-relaxed">
                Run on your existing PostgreSQL instance and private cloud. No proprietary storage engines, no third-party telemetry requirements, and 100% data ownership.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-xs">
              <div className="p-3 bg-black/80 border border-white/10 text-[11px] space-y-1.5 text-zinc-400">
                <div className="flex items-center gap-2 text-white">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PostgreSQL 14+ compatible</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Single container or native binary</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zero external message broker dependencies</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
