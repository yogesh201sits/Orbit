"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Clock,
  Zap,
  Terminal,
  Activity,
  ArrowRight,
  ShieldCheck,
  Play,
  Pause,
} from "lucide-react";

export type StepState = "pending" | "running" | "failed" | "retrying" | "completed";

interface StepNode {
  id: string;
  name: string;
  type: "trigger" | "step" | "sleep" | "action";
  duration: string;
  subtext: string;
}

const WORKFLOW_STEPS: StepNode[] = [
  { id: "trigger", name: "TRIGGER", type: "trigger", duration: "0.2ms", subtext: "POST /v1/workflows/runs" },
  { id: "validate", name: "VALIDATE ORDER", type: "step", duration: "42ms", subtext: "Zod payload schema check" },
  { id: "charge", name: "CHARGE PAYMENT", type: "step", duration: "184ms", subtext: "Stripe API charge (crash target)" },
  { id: "inventory", name: "UPDATE INVENTORY", type: "step", duration: "88ms", subtext: "Postgres decrement stock" },
  { id: "notify", name: "SEND CONFIRMATION", type: "action", duration: "61ms", subtext: "Transactional email dispatch" },
];

export function WorkflowGraphVisualizer() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [chargeStatus, setChargeStatus] = useState<StepState>("completed");
  const [cyclePhase, setCyclePhase] = useState<
    "triggering" | "validating" | "charging_attempt_1" | "failure_detected" | "retrying_backoff" | "recovered" | "inventory" | "completed"
  >("completed");
  const [paused, setPaused] = useState(false);
  const [timelineLogs, setTimelineLogs] = useState<Array<{ time: string; text: string; type: "info" | "warn" | "error" | "success" }>>([
    { time: "10:42:01", text: "Workflow run_9f82a17b initialized via SDK", type: "info" },
    { time: "10:42:02", text: "Step 'validate-order' verified input checksum", type: "success" },
    { time: "10:42:03", text: "Step 'charge-payment' encountered HTTP 429 quota exhaustion", type: "error" },
    { time: "10:42:04", text: "Lease preserved. Executing exponential retry attempt 2/3", type: "warn" },
    { time: "10:42:05", text: "State restored from checkpoint. Charge succeeded ($150.00)", type: "success" },
    { time: "10:42:06", text: "Workflow completed in 375ms across 5 durable steps", type: "success" },
  ]);

  // Automated visual demonstration cycle
  useEffect(() => {
    if (paused) return;

    let timeout: NodeJS.Timeout;

    const runCycle = () => {
      // Phase 1: Trigger
      setCyclePhase("triggering");
      setActiveStepIndex(0);
      setChargeStatus("pending");

      timeout = setTimeout(() => {
        // Phase 2: Validate
        setCyclePhase("validating");
        setActiveStepIndex(1);

        timeout = setTimeout(() => {
          // Phase 3: Charge Payment (Attempt 1 - hits transient fail)
          setCyclePhase("charging_attempt_1");
          setActiveStepIndex(2);
          setChargeStatus("running");

          timeout = setTimeout(() => {
            // Phase 4: Transient Failure Detected
            setCyclePhase("failure_detected");
            setChargeStatus("failed");

            timeout = setTimeout(() => {
              // Phase 5: Automatic Retry with Backoff
              setCyclePhase("retrying_backoff");
              setChargeStatus("retrying");

              timeout = setTimeout(() => {
                // Phase 6: Recovered & Step 2 Completed
                setCyclePhase("recovered");
                setChargeStatus("completed");

                timeout = setTimeout(() => {
                  // Phase 7: Step 3 - Inventory
                  setCyclePhase("inventory");
                  setActiveStepIndex(3);

                  timeout = setTimeout(() => {
                    // Phase 8: Final Step - Confirmation
                    setCyclePhase("completed");
                    setActiveStepIndex(4);

                    timeout = setTimeout(runCycle, 4000);
                  }, 900);
                }, 900);
              }, 1200);
            }, 1000);
          }, 800);
        }, 800);
      }, 700);
    };

    runCycle();
    return () => clearTimeout(timeout);
  }, [paused]);

  const getNodeState = (index: number): StepState => {
    if (index === 2) return chargeStatus;
    if (index < activeStepIndex) return "completed";
    if (index === activeStepIndex) {
      if (cyclePhase === "completed") return "completed";
      return "running";
    }
    return "pending";
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto font-mono select-none">
      {/* Background Ambient Glow */}
      <div
        className="absolute -inset-4 bg-radial-purple-glow opacity-75 blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Glass/Tech Canvas */}
      <div className="relative border border-white/10 bg-[#0D0B15]/90 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Top Control Bar */}
        <div className="px-4 py-3 bg-[#141020]/80 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#A6A1B5] font-bold uppercase tracking-wider">
                EXECUTION RUN:
              </span>
              <span className="text-[#A78BFA] font-bold">run_9f82a17b</span>
              <span className="px-1.5 py-0.5 text-[10px] font-black bg-[#8B5CF6]/20 border border-[#8B5CF6]/50 text-[#C4B5FD] uppercase">
                POSTGRESQL DURABLE LEASE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              className="flex items-center gap-1 text-[11px] text-[#A6A1B5] hover:text-white px-2 py-1 bg-black/40 border border-white/10 hover:border-[#8B5CF6]/40 transition-colors"
            >
              {paused ? (
                <>
                  <Play className="w-3 h-3 text-emerald-400" />
                  <span>Resume Demo</span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 text-[#A78BFA]" />
                  <span>Pause Demo</span>
                </>
              )}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="hidden sm:inline">LIVE ENGINE</span>
            </div>
          </div>
        </div>

        {/* Workflow Graph Canvas */}
        <div className="p-6 sm:p-8 bg-grid-tech bg-dot-matrix-subtle relative min-h-[380px] flex flex-col justify-between">
          {/* Floating Metadata Pill Left */}
          <div className="absolute top-4 left-4 z-20 hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#141020]/90 border border-white/10 backdrop-blur-md shadow-lg text-[11px]">
            <Activity className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="text-zinc-400">STATE:</span>
            <span className="text-white font-bold uppercase">
              {cyclePhase.replace("_", " ")}
            </span>
          </div>

          {/* Floating Metadata Pill Right */}
          <div className="absolute top-4 right-4 z-20 hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#141020]/90 border border-white/10 backdrop-blur-md shadow-lg text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-400">PERSISTENCE:</span>
            <span className="text-emerald-400 font-bold uppercase">TRANSACTIONAL OUTBOX</span>
          </div>

          {/* Connected Workflow Nodes (Vertical layout for clarity and storytelling) */}
          <div className="max-w-2xl mx-auto w-full py-4 space-y-4 relative z-10">
            {WORKFLOW_STEPS.map((step, idx) => {
              const state = getNodeState(idx);
              const isFailedOrRetrying = idx === 2 && (chargeStatus === "failed" || chargeStatus === "retrying");

              return (
                <div key={step.id} className="relative group">
                  {/* Connecting Line from Previous Node */}
                  {idx > 0 && (
                    <div className="absolute -top-4 left-6 sm:left-7 w-0.5 h-4 -translate-x-1/2">
                      <div
                        className={`w-full h-full transition-colors duration-300 ${
                          getNodeState(idx - 1) === "completed"
                            ? "bg-[#8B5CF6] shadow-[0_0_8px_#8B5CF6]"
                            : "bg-white/10"
                        }`}
                      />
                      {/* Animated Pulse traveling on wire */}
                      {getNodeState(idx - 1) === "completed" && state === "running" && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#FFFFFF] animate-bounce" />
                      )}
                    </div>
                  )}

                  {/* Node Box */}
                  <div
                    className={`flex items-center justify-between p-3.5 sm:p-4 border transition-all duration-200 ${
                      isFailedOrRetrying
                        ? "bg-red-950/20 border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.25)]"
                        : state === "running"
                        ? "bg-[#171326] border-[#8B5CF6] shadow-[0_0_20px_rgba(139,92,246,0.35)] translate-x-1"
                        : state === "completed"
                        ? "bg-[#0D0B15]/90 border-white/15 hover:border-[#8B5CF6]/50"
                        : "bg-[#0A0812]/50 border-white/5 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      {/* Node Status Indicator Icon */}
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center shrink-0 border transition-all ${
                          state === "completed"
                            ? "bg-[#8B5CF6]/20 border-[#8B5CF6] text-white"
                            : isFailedOrRetrying
                            ? "bg-red-500/20 border-red-500 text-red-400"
                            : state === "running"
                            ? "bg-[#8B5CF6] border-white text-white animate-pulse"
                            : "bg-black/60 border-white/10 text-zinc-600"
                        }`}
                      >
                        {state === "completed" ? (
                          <CheckCircle2 className="w-4 h-4 text-[#A78BFA]" />
                        ) : state === "failed" ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : state === "retrying" ? (
                          <RotateCw className="w-4 h-4 text-yellow-400 animate-spin" />
                        ) : state === "running" ? (
                          <Zap className="w-4 h-4 text-white" />
                        ) : (
                          <span className="text-[10px] text-zinc-500">0{idx + 1}</span>
                        )}
                      </div>

                      {/* Node Labels */}
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs sm:text-sm font-black tracking-wider uppercase truncate ${
                              state === "completed"
                                ? "text-white"
                                : isFailedOrRetrying
                                ? "text-red-300"
                                : state === "running"
                                ? "text-white"
                                : "text-zinc-500"
                            }`}
                          >
                            {step.name}
                          </span>

                          {/* Extra Status Badges */}
                          {state === "failed" && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-red-500/30 text-red-300 border border-red-500/50 uppercase animate-pulse">
                              FAIL: RATE LIMIT 429
                            </span>
                          )}
                          {state === "retrying" && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 uppercase">
                              RETRY ATTEMPT 2/3 (BACKOFF)
                            </span>
                          )}
                          {idx === 2 && cyclePhase === "recovered" && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                              STATE RESTORED
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] sm:text-[11px] text-zinc-400 truncate block mt-0.5">
                          {step.subtext}
                        </span>
                      </div>
                    </div>

                      {/* Right: State Label & Duration */}
                    <div className="text-right shrink-0 font-mono pl-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 block ${
                          state === "completed"
                            ? "text-emerald-400 bg-emerald-950/40 border border-emerald-500/30"
                            : isFailedOrRetrying
                            ? "text-red-400 bg-red-950/40 border border-red-500/40"
                            : state === "running"
                            ? "text-white bg-[#8B5CF6]/30 border border-[#8B5CF6]"
                            : "text-zinc-600 bg-black/30 border border-white/5"
                        }`}
                      >
                        {state}
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-1 block">
                        {state === "completed" ? step.duration : "--"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Execution Timeline Feed */}
          <div className="mt-4 pt-4 border-t border-white/10 bg-black/60 p-4 relative z-10">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-white">
                <Terminal className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>Deterministic Execution Timeline</span>
              </div>
              <span className="text-[10px] text-[#A78BFA] font-bold uppercase tracking-wider">
                ORBIT DURABLE ENGINE V1
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              {timelineLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="text-zinc-500 select-none text-[11px] shrink-0 font-mono">
                    {log.time}
                  </span>
                  <span
                    className={`text-[11px] truncate ${
                      log.type === "error"
                        ? "text-red-400 font-bold"
                        : log.type === "warn"
                        ? "text-yellow-300 font-semibold"
                        : log.type === "success"
                        ? "text-emerald-400"
                        : "text-[#A6A1B5]"
                    }`}
                  >
                    // {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
