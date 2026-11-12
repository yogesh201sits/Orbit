"use client";

import React, { useState } from "react";
import { Terminal, Copy, Check, Code2, ArrowRight, Play, Database, RotateCw } from "lucide-react";

export function HowItWorks() {
  const [copied, setCopied] = useState(false);
  const [activeStage, setActiveStage] = useState<0 | 1 | 2>(0);

  const codeSnippet = `import { Orbit } from "@durable/sdk";

// 1. Initialize Orbit Client / Worker
const orbit = new Orbit({
  apiKey: process.env.ORBIT_API_KEY,
  baseUrl: process.env.ORBIT_API_URL || "http://localhost:3001",
});

// 2. Define Durable Function-First Workflow
export const orderWorkflow = orbit.workflow(
  {
    id: "process-order",
    version: 1,
    name: "Order Processing & Settlement",
  },
  async ({ input, step }) => {
    // Step 1: Charge card (Checkpoint saved in Postgres)
    const payment = await step.run("charge-card", async () => {
      return await paymentGateway.charge({
        amount: input.amount,
        customerId: input.customerId,
      });
    });

    // Step 2: Durable Sleep (Thread suspended, zero compute waste)
    await step.sleep("settle-delay", "1h");

    // Step 3: Fulfill Order (Resumed automatically after delay)
    return await step.run("fulfill-order", async () => {
      return await inventory.shipOrder({
        paymentId: payment.id,
        items: input.items,
      });
    });
  }
);

// 3. Register with Control Plane
await orbit.register(orderWorkflow);`;

  const copyCode = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stages = [
    {
      number: "01",
      title: "Define",
      subtitle: "Plain TypeScript Functions",
      desc: "Define workflows using standard async functions and Orbit's typed SDK. No DSLs, no JSON schemas, and no complicated state machine configuration files.",
      icon: Code2,
    },
    {
      number: "02",
      title: "Execute",
      subtitle: "Step Checkpoints & Outbox",
      desc: "Each step runs within an isolated transaction. Step outputs are committed directly to PostgreSQL with automatic idempotency and lease management.",
      icon: Database,
    },
    {
      number: "03",
      title: "Recover",
      subtitle: "Instant State Replay",
      desc: "When servers crash, network drops occur, or transient rate limits hit, Orbit replays completed steps from disk and resumes at the interrupted step.",
      icon: RotateCw,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 sm:py-32 relative bg-[#0D0B15] font-mono border-y border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#A78BFA]">
            // DEVELOPER WORKFLOW
          </span>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-[#F8F7FC] font-sans">
            From function to <br />
            <span className="text-[#8B5CF6]">durable execution.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#A6A1B5] font-sans">
            Three simple stages turn volatile application logic into fault-tolerant distributed processes.
          </p>
        </div>

        {/* 3-Stage Horizontally Connected Pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isSelected = activeStage === idx;
            return (
              <div
                key={stage.number}
                onClick={() => setActiveStage(idx as any)}
                className={`p-6 border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "bg-[#141020] border-[#8B5CF6] shadow-[4px_4px_0px_#8B5CF6]"
                    : "bg-[#08070D] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <span className="text-2xl font-black text-[#8B5CF6]">{stage.number}</span>
                  <Icon className={`w-5 h-5 ${isSelected ? "text-white" : "text-zinc-500"}`} />
                </div>
                <div className="mt-4 space-y-1.5">
                  <h3 className="text-lg font-black uppercase text-white tracking-wide">
                    {stage.title}
                  </h3>
                  <span className="text-xs font-bold text-[#A78BFA] block">
                    // {stage.subtitle}
                  </span>
                  <p className="text-xs text-[#A6A1B5] font-sans leading-relaxed pt-2">
                    {stage.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Code Showcase Terminal */}
        <div className="border-2 border-white/15 bg-[#08070D] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Terminal Title Bar */}
          <div className="px-4 py-3 bg-[#141020] border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-white font-bold">src/workflows/order.ts</span>
                <span className="text-zinc-500 text-[10px] hidden sm:inline">— TypeScript SDK</span>
              </div>
            </div>

            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1 bg-black/60 hover:bg-black border border-white/15 text-xs font-bold uppercase text-zinc-300 hover:text-white transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span>COPY SNIPPET</span>
                </>
              )}
            </button>
          </div>

          {/* Code Body with Line Numbers */}
          <div className="p-4 sm:p-6 overflow-x-auto text-xs leading-relaxed font-mono bg-black/80">
            <pre className="text-[#C4B5FD]">
              {codeSnippet.split("\n").map((line, idx) => {
                const lineNum = String(idx + 1).padStart(2, "0");
                const isComment = line.trim().startsWith("//");
                const isKeyword = line.includes("import ") || line.includes("export ") || line.includes("const ") || line.includes("async ") || line.includes("await ") || line.includes("return ");

                return (
                  <div key={idx} className="flex hover:bg-white/5 px-2 py-0.5 -mx-2 rounded-none">
                    <span className="text-zinc-600 select-none w-8 shrink-0 text-right pr-4 font-mono">
                      {lineNum}
                    </span>
                    <span
                      className={
                        isComment
                          ? "text-[#706B80] font-semibold"
                          : isKeyword
                          ? "text-[#F8F7FC] font-semibold"
                          : "text-[#C4B5FD]"
                      }
                    >
                      {line}
                    </span>
                  </div>
                );
              })}
            </pre>
          </div>

          {/* Bottom Terminal Status Bar */}
          <div className="px-4 py-2.5 bg-[#050508] border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-bold">● TypeScript 5.x Ready</span>
              <span className="hidden sm:inline text-zinc-600">|</span>
              <span className="hidden sm:inline">Zero compilation codegen required</span>
            </div>
            <span className="text-[#A78BFA] font-bold">@durable/sdk@0.1.0</span>
          </div>
        </div>
      </div>
    </section>
  );
}
