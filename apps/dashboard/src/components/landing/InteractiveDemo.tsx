"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Activity,
  Layers,
  Clock,
  ShieldCheck,
  RefreshCw,
  Bug,
  Zap,
} from "lucide-react";

interface DemoStep {
  id: string;
  name: string;
  status: "pending" | "running" | "failed" | "completed";
  duration: string;
  output?: string;
}

const INITIAL_STEPS: DemoStep[] = [
  { id: "s1", name: "1. parse-and-validate", status: "pending", duration: "--" },
  { id: "s2", name: "2. reserve-inventory", status: "pending", duration: "--" },
  { id: "s3", name: "3. process-stripe-charge", status: "pending", duration: "--" },
  { id: "s4", name: "4. issue-customer-receipt", status: "pending", duration: "--" },
];

export function InteractiveDemo() {
  const [steps, setSteps] = useState<DemoStep[]>(INITIAL_STEPS);
  const [workflowStatus, setWorkflowStatus] = useState<"idle" | "running" | "failed" | "recovering" | "completed">("idle");
  const [retriesCount, setRetriesCount] = useState(0);
  const [logs, setLogs] = useState<Array<{ timestamp: string; message: string; type: "info" | "warn" | "error" | "success" }>>([
    { timestamp: "00:00.00", message: "Ready. Click 'Start Workflow' or 'Simulate Failure' to begin.", type: "info" },
  ]);

  const addLog = (message: string, type: "info" | "warn" | "error" | "success" = "info") => {
    const time = new Date().toISOString().substring(14, 22);
    setLogs((prev) => [...prev.slice(-8), { timestamp: time, message, type }]);
  };

  const handleStart = () => {
    setWorkflowStatus("running");
    setRetriesCount(0);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" })));
    addLog("Workflow run_44a91c initialized with Idempotency-Key 'order_981'", "info");

    // Run step 1
    setTimeout(() => {
      setSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "completed", duration: "12ms", output: "{ valid: true }" } : s))
      );
      addLog("Step 1 'parse-and-validate' executed and checkpointed", "success");

      // Run step 2
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) => (i === 1 ? { ...s, status: "completed", duration: "48ms", output: "{ reservedId: 'inv_441' }" } : s))
        );
        addLog("Step 2 'reserve-inventory' committed to database", "success");

        // Run step 3
        setTimeout(() => {
          setSteps((prev) =>
            prev.map((s, i) => (i === 2 ? { ...s, status: "completed", duration: "192ms", output: "{ chargeId: 'ch_8912', status: 'PAID' }" } : s))
          );
          addLog("Step 3 'process-stripe-charge' finished successfully", "success");

          // Run step 4
          setTimeout(() => {
            setSteps((prev) =>
              prev.map((s, i) => (i === 3 ? { ...s, status: "completed", duration: "34ms", output: "{ emailSent: true }" } : s))
            );
            setWorkflowStatus("completed");
            addLog("Step 4 'issue-customer-receipt' sent. Workflow completed!", "success");
          }, 600);
        }, 600);
      }, 600);
    }, 500);
  };

  const handleSimulateCrash = () => {
    setWorkflowStatus("running");
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" })));
    addLog("Workflow started. Injected failure at Step 3...", "warn");

    // Step 1
    setTimeout(() => {
      setSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "completed", duration: "12ms", output: "{ valid: true }" } : s))
      );
      addLog("Step 1 checkpointed", "success");

      // Step 2
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) => (i === 1 ? { ...s, status: "completed", duration: "45ms", output: "{ reservedId: 'inv_441' }" } : s))
        );
        addLog("Step 2 checkpointed", "success");

        // Step 3 Crashes
        setTimeout(() => {
          setSteps((prev) =>
            prev.map((s, i) => (i === 2 ? { ...s, status: "failed", duration: "110ms" } : s))
          );
          setWorkflowStatus("failed");
          addLog("CRITICAL FAILURE: Worker process evicted mid-execution on Step 3!", "error");
          addLog("Steps 1 and 2 outputs are SAFE in PostgreSQL. Ready to recover.", "warn");
        }, 700);
      }, 600);
    }, 500);
  };

  const handleRecover = () => {
    if (workflowStatus !== "failed") return;

    setWorkflowStatus("recovering");
    setRetriesCount((c) => c + 1);
    addLog("Recovery daemon claiming expired lease on run_44a91c...", "info");

    setTimeout(() => {
      addLog("Restored step 1 and step 2 outputs from PostgreSQL. Skipping duplicate work.", "info");

      // Step 3 re-runs
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, i) => (i === 2 ? { ...s, status: "completed", duration: "185ms", output: "{ chargeId: 'ch_8912', status: 'PAID' }" } : s))
        );
        addLog("Step 3 'process-stripe-charge' succeeded on recovery attempt!", "success");

        // Step 4 finishes
        setTimeout(() => {
          setSteps((prev) =>
            prev.map((s, i) => (i === 3 ? { ...s, status: "completed", duration: "32ms", output: "{ emailSent: true }" } : s))
          );
          setWorkflowStatus("completed");
          addLog("Workflow 100% recovered and finalized without human intervention.", "success");
        }, 600);
      }, 700);
    }, 600);
  };

  const handleReset = () => {
    setWorkflowStatus("idle");
    setRetriesCount(0);
    setSteps(INITIAL_STEPS);
    setLogs([{ timestamp: "00:00.00", message: "Demo reset to idle state.", type: "info" }]);
  };

  return (
    <section id="interactive-demo" className="py-24 sm:py-32 relative bg-[#08070D]/40 backdrop-blur-[1px] font-mono">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#A78BFA]">
            // LIVE SIMULATION PLAYGROUND
          </span>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-[#F8F7FC] font-sans">
            See what happens <br />
            <span className="text-[#8B5CF6]">when things go wrong.</span>
          </h2>
          <p className="text-base sm:text-lg text-[#A6A1B5] font-sans">
            Experience deterministic execution recovery firsthand. Simulate worker crashes, network drops, and watch Orbit resume without re-running completed steps.
          </p>
        </div>

        {/* Interactive Simulated Product Console */}
        <div className="max-w-4xl mx-auto border-2 border-white/15 bg-[#0D0B15] shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* Top Console Bar */}
          <div className="px-5 py-4 bg-[#141020] border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#8B5CF6] animate-pulse" />
              <div>
                <span className="text-xs font-bold text-white uppercase block">
                  Run: run_44a91c (order-settlement)
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  Execution queue: default // Lease: worker-node-03
                </span>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400">RETRIES: {retriesCount}</span>
              <span
                className={`px-3 py-1 text-xs font-black uppercase tracking-wider border ${
                  workflowStatus === "completed"
                    ? "bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                    : workflowStatus === "failed"
                    ? "bg-red-950/60 border-red-500 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse"
                    : workflowStatus === "recovering"
                    ? "bg-yellow-950/60 border-yellow-500 text-yellow-300"
                    : workflowStatus === "running"
                    ? "bg-[#8B5CF6]/30 border-[#8B5CF6] text-white"
                    : "bg-black/50 border-white/10 text-zinc-500"
                }`}
              >
                STATUS: {workflowStatus}
              </span>
            </div>
          </div>

          {/* Interactive Controls Bar */}
          <div className="px-5 py-3.5 bg-black/70 border-b border-white/10 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleStart}
              disabled={workflowStatus === "running" || workflowStatus === "recovering"}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-40 text-xs font-bold uppercase text-white border border-white shadow-[2px_2px_0px_#000000] active:translate-y-0.5 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Normal Run</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateCrash}
              disabled={workflowStatus === "running" || workflowStatus === "recovering"}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-500 text-xs font-bold uppercase text-red-300 shadow-[2px_2px_0px_#000000] disabled:opacity-40 active:translate-y-0.5 transition-all"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Simulate Crash</span>
            </button>

            <button
              type="button"
              onClick={handleRecover}
              disabled={workflowStatus !== "failed"}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold uppercase border shadow-[2px_2px_0px_#000000] transition-all ${
                workflowStatus === "failed"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white border-white animate-bounce"
                  : "bg-black/40 text-zinc-600 border-white/5 cursor-not-allowed opacity-50"
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry & Recover</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-black border border-white/15 hover:border-white/40 text-xs font-bold uppercase text-zinc-400 hover:text-white transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Steps Progress List */}
          <div className="p-6 space-y-3 bg-[#08070D]">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`p-3.5 border transition-all ${
                  step.status === "completed"
                    ? "bg-[#0D0B15] border-white/10"
                    : step.status === "failed"
                    ? "bg-red-950/30 border-red-500 text-red-300"
                    : step.status === "running"
                    ? "bg-[#141020] border-[#8B5CF6]"
                    : "bg-black/40 border-white/5 opacity-40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {step.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : step.status === "failed" ? (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : step.status === "running" ? (
                      <RotateCw className="w-4 h-4 text-[#8B5CF6] animate-spin shrink-0" />
                    ) : (
                      <span className="w-4 h-4 border border-zinc-700 rounded-full inline-block" />
                    )}
                    <span className="text-xs font-bold uppercase text-white tracking-wider">
                      {step.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    {step.output && (
                      <code className="hidden sm:inline text-[11px] text-[#A78BFA] bg-black/60 px-2 py-0.5 border border-white/10">
                        {step.output}
                      </code>
                    )}
                    <span className="text-[11px] text-zinc-400">{step.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Event Logs Terminal Window */}
          <div className="p-4 bg-black border-t border-white/10 space-y-1.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-zinc-500 text-[10px]">
              <span className="uppercase font-bold text-white">// ENGINE EVENT LOGS</span>
              <span>IMMUTABLE AUDIT TRAIL</span>
            </div>
            {logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2.5 font-mono text-[11px]">
                <span className="text-zinc-500 select-none">{log.timestamp}</span>
                <span
                  className={
                    log.type === "error"
                      ? "text-red-400 font-bold"
                      : log.type === "warn"
                      ? "text-yellow-300 font-bold"
                      : log.type === "success"
                      ? "text-emerald-400"
                      : "text-zinc-300"
                  }
                >
                  &gt; {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
