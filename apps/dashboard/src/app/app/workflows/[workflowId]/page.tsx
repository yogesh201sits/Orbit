"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  GitFork,
  Play,
  RotateCw,
  Clock,
  History,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  Code,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { MetricCard } from "@/components/ui/MetricCard";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { api } from "@/lib/api/client";
import { formatDate, formatDuration, formatRelativeTime, truncateId } from "@/lib/formatting";
import type { WorkflowItem, WorkflowRunItem } from "@/types/orbit";

export const dynamic = "force-dynamic";

export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const resolvedParams = use(params);
  const workflowId = resolvedParams.workflowId;

  const [workflow, setWorkflow] = useState<WorkflowItem | null>(null);
  const [runs, setRuns] = useState<WorkflowRunItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggerOpen, setIsTriggerOpen] = useState(false);
  const [triggerInput, setTriggerInput] = useState('{\n  "mode": "standard"\n}');
  const [triggerIdempotencyKey, setTriggerIdempotencyKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [wfRes, runsRes] = await Promise.all([
        api.getWorkflow(workflowId),
        api.listRuns({ workflowId, limit: 10 }),
      ]);
      setWorkflow(wfRes.data);
      setRuns(runsRes.data);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workflowId]);

  const handleTriggerRun = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsedInput = {};
    try {
      parsedInput = JSON.parse(triggerInput);
    } catch {
      alert("Invalid JSON format for input payload.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.triggerRun(
        workflowId,
        parsedInput,
        triggerIdempotencyKey.trim() || undefined
      );
      setIsTriggerOpen(false);
      await loadData();
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workflow && !isLoading) {
    return (
      <div className="p-8 text-center border border-[#292532] rounded-lg bg-[#14141B]">
        <h2 className="text-base font-semibold text-zinc-200">Workflow Not Found</h2>
        <p className="text-xs text-zinc-400 mt-1">
          No workflow exists with identifier &quot;{workflowId}&quot;.
        </p>
        <Link
          href="/app/workflows"
          className="mt-4 inline-block px-3 py-1.5 rounded-md bg-[#1B1923] border border-[#292532] text-xs font-medium text-white"
        >
          Back to Workflows
        </Link>
      </div>
    );
  }

  const completedCount = runs.filter((r) => r.status === "completed").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={workflow?.name || "Workflow"}
        description={`Key: ${workflow?.key || workflowId}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Workflows", href: "/app/workflows" },
          { label: workflow?.key || workflowId },
        ]}
        actions={
          <div className="flex items-center gap-2.5">
            <Link
              href={`/app/workflows/${workflowId}/versions`}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-[#14101F] border-2 border-[#8B5CF6] text-xs font-mono font-bold uppercase tracking-wider text-white shadow-[2px_2px_0px_#8B5CF6] transition-all"
            >
              <History className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>Version History</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsTriggerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-mono font-black uppercase tracking-wider text-white border-2 border-white shadow-[3px_3px_0px_#FFFFFF] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Trigger Execution</span>
            </button>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Registered Version"
          value={`v${workflow?.latestVersion || 1}`}
          subtext="Active in production"
          icon={<Layers className="w-4 h-4 text-[#8B5CF6]" />}
        />
        <MetricCard
          label="Total Executions"
          value={runs.length.toLocaleString()}
          subtext="Retained runs"
          icon={<History className="w-4 h-4 text-zinc-400" />}
        />
        <MetricCard
          label="Completed"
          value={completedCount}
          subtext="Successful completions"
          icon={<CheckCircle2 className="w-4 h-4 text-white" />}
        />
        <MetricCard
          label="Failed"
          value={failedCount}
          subtext="Requires retry / recovery"
          icon={<AlertTriangle className="w-4 h-4 text-[#A78BFA]" />}
        />
      </div>

      {/* Metadata & Configuration Card */}
      <div className="rounded-lg border border-[#292532] bg-[#14141B] p-5">
        <h2 className="text-sm font-semibold text-[#F5F3FF] pb-3 border-b border-[#292532]">
          Workflow Metadata
        </h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <span className="text-zinc-500 block text-[11px]">Workflow ID</span>
            <div className="flex items-center gap-1 text-zinc-200 mt-1">
              <span>{workflow?.id}</span>
              {workflow?.id && <CopyButton value={workflow.id} />}
            </div>
          </div>
          <div>
            <span className="text-zinc-500 block text-[11px]">Programmatic Key</span>
            <div className="flex items-center gap-1 text-[#A78BFA] mt-1 font-semibold">
              <span>{workflow?.key}</span>
              {workflow?.key && <CopyButton value={workflow.key} />}
            </div>
          </div>
          <div>
            <span className="text-zinc-500 block text-[11px]">Registered At</span>
            <span className="text-zinc-200 mt-1 block">
              {formatDate(workflow?.createdAt)}
            </span>
          </div>
        </div>

        {workflow?.metadata && (
          <div className="mt-4 pt-4 border-t border-[#292532]/60">
            <JsonViewer data={workflow.metadata} title="Metadata Configuration" />
          </div>
        )}
      </div>

      {/* Executions for this workflow */}
      <div className="rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#292532] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#F5F3FF]">Execution History</h2>
            <p className="text-xs text-[#A1A1AA]">Runs for this workflow definition</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1"
          >
            <RotateCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#0D0D12] border-b border-[#292532] text-zinc-400 font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-4 font-medium">Run ID</th>
                <th className="py-2.5 px-4 font-medium">Version</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Duration</th>
                <th className="py-2.5 px-4 font-medium">Started</th>
                <th className="py-2.5 px-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292532]/60 font-mono">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="hover:bg-[#1B1923]/60 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 text-zinc-300">
                    <div className="flex items-center gap-1">
                      <Link href={`/app/runs/${run.id}`} className="hover:text-[#A78BFA] transition-colors">
                        {truncateId(run.id, 8, 4)}
                      </Link>
                      <CopyButton value={run.id} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-zinc-400">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1B1923] border border-[#292532]">
                      v{run.versionNumber || 1}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={run.status} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-zinc-300">
                    {formatDuration(run.durationMs, run.startedAt, run.completedAt)}
                  </td>
                  <td className="py-3 px-4 text-zinc-400">
                    {formatRelativeTime(run.startedAt || run.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/app/runs/${run.id}`}
                      className="px-2 py-0.5 rounded text-[11px] text-zinc-300 hover:text-white bg-[#1B1923] border border-[#292532] inline-flex items-center gap-1"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trigger Run Dialog */}
      {isTriggerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-100 font-mono">
          <div className="w-full max-w-lg border-2 border-[#8B5CF6] bg-[#0A0A0F] p-6 shadow-[6px_6px_0px_#8B5CF6] flex flex-col gap-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#2D273D]">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-[#8B5CF6] fill-current" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Trigger Execution: {workflow?.key}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsTriggerOpen(false)}
                className="text-zinc-400 hover:text-white p-1 hover:bg-[#151120] border border-transparent hover:border-[#8B5CF6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTriggerRun} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Idempotency Key (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. order_99412_checkout"
                  value={triggerIdempotencyKey}
                  onChange={(e) => setTriggerIdempotencyKey(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] px-3 py-2 text-xs text-white font-mono outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">
                  Input Payload (JSON)
                </label>
                <textarea
                  rows={6}
                  value={triggerInput}
                  onChange={(e) => setTriggerInput(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] p-3 text-xs text-white font-mono outline-none focus:border-[#8B5CF6] scrollbar-thin resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#2D273D]">
                <button
                  type="button"
                  onClick={() => setIsTriggerOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-black border-2 border-[#2D273D] hover:border-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-black uppercase tracking-wider bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-white shadow-[3px_3px_0px_#FFFFFF] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-1.5"
                >
                  {isSubmitting && <span className="w-3 h-3 border-2 border-white/40 border-t-white animate-spin" />}
                  Trigger Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
