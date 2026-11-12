"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  PlayCircle,
  RotateCw,
  RotateCcw,
  Ban,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Activity,
  Terminal,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/api/client";
import { formatDate, formatDuration, formatRelativeTime, truncateId } from "@/lib/formatting";
import type { WorkflowRunItem, WorkflowStepItem, WorkflowEventItem } from "@/types/orbit";

export const dynamic = "force-dynamic";

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const resolvedParams = use(params);
  const runId = resolvedParams.runId;

  const [run, setRun] = useState<WorkflowRunItem | null>(null);
  const [steps, setSteps] = useState<WorkflowStepItem[]>([]);
  const [events, setEvents] = useState<WorkflowEventItem[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Recovery dialog
  const [confirmAction, setConfirmAction] = useState<"cancel" | "retry" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [runRes, stepsRes, eventsRes] = await Promise.all([
        api.getRun(runId),
        api.getRunSteps(runId),
        api.getRunEvents(runId),
      ]);

      setRun(runRes.data);
      setSteps(stepsRes.data);
      setEvents(eventsRes.data);
      if (stepsRes.data.length > 0 && !selectedStepId) {
        setSelectedStepId(stepsRes.data[0]?.id || null);
      }
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [runId]);

  const handleAction = async () => {
    if (!confirmAction) return;
    setIsSubmitting(true);
    try {
      if (confirmAction === "cancel") {
        await api.cancelRun(runId);
      } else if (confirmAction === "retry") {
        await api.retryRun(runId);
      }
      setConfirmAction(null);
      await loadData();
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStep = steps.find((s) => s.id === selectedStepId) || steps[0] || null;

  if (!run && !isLoading) {
    return (
      <div className="p-8 text-center border border-[#292532] rounded-lg bg-[#14141B]">
        <h2 className="text-base font-semibold text-zinc-200">Execution Not Found</h2>
        <p className="text-xs text-zinc-400 mt-1">
          No workflow run exists with ID &quot;{runId}&quot;.
        </p>
        <Link
          href="/app/runs"
          className="mt-4 inline-block px-3 py-1.5 rounded-md bg-[#1B1923] border border-[#292532] text-xs font-medium text-white"
        >
          Back to Runs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={run?.workflowName || run?.workflowKey || "Run Execution"}
        description={`Run ID: ${runId}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Runs", href: "/app/runs" },
          { label: truncateId(runId, 8, 4) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#14141B] hover:bg-[#1B1923] border border-[#292532] text-xs font-medium text-zinc-300 transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#8B5CF6]" : ""}`} />
              <span>Refresh</span>
            </button>

            {run?.status === "running" && (
              <button
                type="button"
                onClick={() => setConfirmAction("cancel")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-xs font-medium text-rose-300 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel Run</span>
              </button>
            )}

            {run?.status === "failed" && (
              <button
                type="button"
                onClick={() => setConfirmAction("retry")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-medium text-white transition-colors shadow-[0_0_12px_rgba(139,92,246,0.25)]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Run</span>
              </button>
            )}
          </div>
        }
      />

      {/* Header Overview Card */}
      <div className="rounded-lg border border-[#292532] bg-[#14141B] p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-[#292532] gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={run?.status || "pending"} />
            <span className="font-mono text-xs text-zinc-400">
              Revision <span className="text-zinc-200">#{run?.revision ?? 1}</span>
            </span>
            <span className="font-mono text-xs text-zinc-400">
              Version <span className="text-[#A78BFA]">v{run?.versionNumber ?? 1}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-zinc-400">
            <span>Started: {formatDate(run?.startedAt || run?.createdAt)}</span>
            <span>•</span>
            <span>Duration: {formatDuration(run?.durationMs, run?.startedAt, run?.completedAt)}</span>
          </div>
        </div>

        {/* Technical Attributes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-xs font-mono">
          <div>
            <span className="text-zinc-500 block text-[11px]">Workflow ID</span>
            <div className="flex items-center gap-1 text-zinc-200 mt-1">
              <Link
                href={`/app/workflows/${run?.workflowId}`}
                className="hover:text-[#A78BFA] transition-colors truncate"
              >
                {run?.workflowKey || run?.workflowId}
              </Link>
              {run?.workflowId && <CopyButton value={run.workflowId} />}
            </div>
          </div>

          <div>
            <span className="text-zinc-500 block text-[11px]">Idempotency Key</span>
            <div className="flex items-center gap-1 text-zinc-200 mt-1">
              <span className="truncate">{run?.idempotencyKey || "none"}</span>
              {run?.idempotencyKey && <CopyButton value={run.idempotencyKey} />}
            </div>
          </div>

          <div>
            <span className="text-zinc-500 block text-[11px]">Trigger Source</span>
            <span className="text-zinc-200 mt-1 uppercase block">
              {run?.triggerType || "api"}
            </span>
          </div>

          <div>
            <span className="text-zinc-500 block text-[11px]">Completed At</span>
            <span className="text-zinc-200 mt-1 block">
              {formatDate(run?.completedAt)}
            </span>
          </div>
        </div>

        {/* Error Banner if Failed */}
        {run?.status === "failed" && run.error && (
          <div className="mt-4 p-4 rounded-md bg-rose-950/30 border border-rose-900/50 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs font-mono">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Execution Failure Error:</span>
              {run.error.code && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-900/60 border border-rose-700/50">
                  {run.error.code}
                </span>
              )}
            </div>
            <p className="text-xs text-rose-200/90 font-mono leading-relaxed">
              {run.error.message || "An error occurred during workflow step execution."}
            </p>
            {run.error.stack && (
              <pre className="p-2.5 rounded bg-black/50 border border-rose-950 text-[11px] font-mono text-rose-300/80 overflow-x-auto whitespace-pre leading-relaxed mt-1">
                {run.error.stack}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Split Pane: Step Timeline (Left) & Step Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step Execution Timeline */}
        <div className="lg:col-span-5 rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#292532] bg-[#0D0D12] flex items-center justify-between">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
              Execution Timeline ({steps.length} Steps)
            </h2>
            <span className="text-[10px] font-mono text-zinc-500">Linear DAG</span>
          </div>

          <div className="p-3 flex-1 flex flex-col gap-2 overflow-y-auto">
            {steps.map((step, idx) => {
              const isSelected = selectedStep?.id === step.id;
              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStepId(step.id)}
                  className={`p-3 rounded-md border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#1B1923] border-[#8B5CF6]/60 shadow-[0_0_10px_rgba(139,92,246,0.15)]"
                      : "bg-[#0D0D12]/60 border-[#292532] hover:bg-[#1B1923]/40 hover:border-[#383446]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-xs text-zinc-500">#{idx + 1}</span>
                      <span className="font-mono text-xs font-semibold text-[#F5F3FF] truncate">
                        {step.stepKey}
                      </span>
                    </div>
                    <StatusBadge status={step.status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mt-2 pt-2 border-t border-[#292532]/40">
                    <span>
                      Attempt {step.attempt} • {step.type}
                    </span>
                    <span>{formatDuration(step.durationMs, step.startedAt, step.completedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Step Inspector */}
        <div className="lg:col-span-7 rounded-lg border border-[#292532] bg-[#14141B] p-5 flex flex-col gap-4">
          {selectedStep ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-[#292532]">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#F5F3FF] font-mono">
                      Step: {selectedStep.stepKey}
                    </h3>
                    <StatusBadge status={selectedStep.status} size="sm" />
                  </div>
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">
                    ID: {selectedStep.id} • Type: {selectedStep.type} • Attempt: #{selectedStep.attempt}
                  </p>
                </div>
                <CopyButton value={selectedStep.id} label="Copy Step ID" />
              </div>

              {/* Timing info */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-md bg-[#0D0D12] border border-[#292532] text-xs font-mono">
                <div>
                  <span className="text-zinc-500 text-[10px] block">Started</span>
                  <span className="text-zinc-300">{formatDate(selectedStep.startedAt)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Completed</span>
                  <span className="text-zinc-300">{formatDate(selectedStep.completedAt)}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Duration</span>
                  <span className="text-zinc-300 font-semibold">
                    {formatDuration(selectedStep.durationMs, selectedStep.startedAt, selectedStep.completedAt)}
                  </span>
                </div>
              </div>

              {/* Step Error if present */}
              {selectedStep.error && (
                <div className="p-3 rounded-md bg-rose-950/40 border border-rose-900/50 text-xs font-mono text-rose-300">
                  <div className="font-semibold text-rose-400 mb-1">Step Error:</div>
                  <p className="leading-relaxed">{selectedStep.error.message}</p>
                  {selectedStep.error.stack && (
                    <pre className="mt-2 p-2 rounded bg-black/60 text-[10px] text-rose-400/80 overflow-x-auto whitespace-pre">
                      {selectedStep.error.stack}
                    </pre>
                  )}
                </div>
              )}

              {/* Step Input & Output */}
              <div className="space-y-3">
                <JsonViewer data={selectedStep.input} title="Step Input" maxHeight="200px" />
                <JsonViewer data={selectedStep.output} title="Step Output" maxHeight="200px" />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
              Select a step from the timeline to inspect its parameters.
            </div>
          )}
        </div>
      </div>

      {/* Input / Output Payloads of Workflow Run */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Workflow Run Input Payload
          </h2>
          <JsonViewer data={run?.input} title="Initial Run Input" maxHeight="300px" />
        </div>

        <div>
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Workflow Run Output Payload
          </h2>
          <JsonViewer data={run?.output} title="Final Output Result" maxHeight="300px" />
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={confirmAction === "cancel" ? "Cancel Run Execution" : "Retry Failed Run"}
        description={
          confirmAction === "cancel"
            ? `Are you sure you want to cancel run ${runId}? Active step executions will be halted and the run will enter terminal CANCELLED state.`
            : `Retry will re-enqueue run ${runId} from its failed step state without modifying immutable prior records.`
        }
        confirmLabel={confirmAction === "cancel" ? "Confirm Cancel" : "Confirm Retry"}
        isDestructive={confirmAction === "cancel"}
        isLoading={isSubmitting}
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
