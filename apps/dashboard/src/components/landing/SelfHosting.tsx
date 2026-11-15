"use client";

import React, { useState } from "react";
import { Terminal, Copy, Check, Server, Shield, Database, ArrowRight, Box } from "lucide-react";

export function SelfHosting() {
  const [copied, setCopied] = useState(false);

  const command = `# 1. Clone repository
git clone https://github.com/orbit-durable/orbit.git
cd orbit

# 2. Configure environment & database
cp .env.example .env
bun install

# 3. Deploy PostgreSQL schema
bun run db:migrate:deploy

# 4. Start Orbit API & Control Plane
bun run start`;

  const copyCommand = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="self-hosting" className="py-24 sm:py-32 relative bg-[#0D0B15]/40 backdrop-blur-[1px] font-mono">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text & Features */}
          <div className="space-y-6">
            <span className="text-xs font-bold uppercase tracking-widest text-[#A78BFA]">
              // DEPLOYMENT FREEDOM
            </span>
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#F8F7FC] font-sans">
              Your infrastructure. <br />
              <span className="text-[#8B5CF6]">Your workflows.</span>
            </h2>
            <p className="text-base text-[#A6A1B5] font-sans leading-relaxed">
              Orbit requires only a standard PostgreSQL database and a Node.js or Bun runtime. You retain full control over sensitive customer payloads, internal company networks, and execution data without vendor lock-in.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 bg-[#08070D] border border-white/10">
                <Box className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold uppercase text-white block">No Hidden Proprietary Daemons</span>
                  <span className="text-[11px] text-zinc-400 font-sans">
                    Orbit runs on standard open-source tools with Prisma, Hono, and Bun.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-[#08070D] border border-white/10">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold uppercase text-white block">Air-Gapped & VPC Compatible</span>
                  <span className="text-[11px] text-zinc-400 font-sans">
                    Keep financial workflows and internal customer data entirely within your private network boundaries.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-[#08070D] border border-white/10">
                <Database className="w-4 h-4 text-[#A78BFA] shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold uppercase text-white block">Standard PostgreSQL Schema</span>
                  <span className="text-[11px] text-zinc-400 font-sans">
                    Direct access to execution tables. Query your runs with standard SQL or BI tools anytime.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Terminal Setup Window */}
          <div className="border-2 border-white/15 bg-[#08070D] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="px-4 py-3 bg-[#141020] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-xs font-bold text-white uppercase">Self-Hosting Quickstart</span>
              </div>
              <button
                type="button"
                onClick={copyCommand}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-black/60 hover:bg-black border border-white/15 text-[11px] font-bold uppercase text-zinc-300 hover:text-white transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-[#A78BFA]" />
                    <span>COPY</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-5 text-xs text-[#C4B5FD] leading-relaxed overflow-x-auto bg-black/90">
              <pre className="font-mono">{command}</pre>
            </div>

            <div className="px-4 py-2.5 bg-[#050508] border-t border-white/10 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>PREREQUISITES: BUN 1.3+ &amp; POSTGRESQL 14+</span>
              <span className="text-emerald-400 font-bold">READY TO DEPLOY</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
