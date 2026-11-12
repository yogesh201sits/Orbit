"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  PlayCircle,
  Search,
  Filter,
  RotateCw,
  Clock,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Ban,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api/client";
import { formatDate, formatDuration, formatRelativeTime, truncateId } from "@/lib/formatting";
import type { WorkflowRunItem, WorkflowItem, Pagination } from "@/types/orbit";

export default function RunsPage() {
  const [runs, setRuns] = useState<WorkflowRunItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("all");
  const [searchRunId, setSearchRunId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, limit: 15, offset: 0 });

  // Dialog state
  const [dialogAction, setDialogAction] = useState<"cancel" | "retry" | null>(null);
  const [targetRun, setTargetRun] = useState<WorkflowRunItem | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadData = async (offset = 0) => {
    setIsLoading(true);
    try {
      const [runsRes, wfRes] = await Promise.all([
        api.listRuns({
          limit: pagination.limit,
          offset,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          workflowId: selectedWorkflow !== "all" ? selectedWorkflow : undefined,
        }),
        api.listWorkflows(),
      ]);

      setRuns(runsRes.data);
      setWorkflows(wfRes.data);
      setPagination(runsRes.pagination || { total: runsRes.data.length, limit: 15, offset });
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(0);
  }, [selectedStatus, selectedWorkflow]);

  const handleConfirmAction = async () => {
    if (!targetRun || !dialogAction) return;
    setIsActionLoading(true);
    try {
      if (dialogAction === "cancel") {
        await api.cancelRun(targetRun.id);
      } else if (dialogAction === "retry") {
        await api.retryRun(targetRun.id);
      }
      setDialogAction(null);
      setTargetRun(null);
      await loadData(pagination.offset);
    } catch {
      // Handled
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredRuns = runs.filter((r) => {
    if (!searchRunId) return true;
    return (
      r.id.toLowerCase().includes(searchRunId.toLowerCase()) ||
      (r.workflowKey && r.workflowKey.toLowerCase().includes(searchRunId.toLowerCase()))
    );
  });

  const statuses = [
    { label: "All Statuses", value: "all" },
    { label: "Running", value: "running" },
    { label: "Completed", value: "completed" },
    { label: "Failed", value: "failed" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Waiting", value: "waiting" },
    { label: "Pending", value: "pending" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runs"
        description="Inspect workflow executions across your project."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Runs" },
        ]}
        actions={
          <button
            type="button"
            onClick={() => loadData(pagination.offset)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-[#14101F] border-2 border-[#8B5CF6] text-xs font-mono font-bold uppercase tracking-wider text-white shadow-[2px_2px_0px_#8B5CF6] active:translate-x-[1px] active:translate-y-[1px] transition-all"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#8B5CF6]" : ""}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 font-mono">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Dropdown */}
          <div className="bg-[#0A0A0F] border-2 border-[#2D273D] px-3 py-1.5 text-xs font-mono">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent text-white font-bold uppercase tracking-wider outline-none cursor-pointer"
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value} className="bg-black text-white">
                  STATUS: {s.label.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Workflow Filter */}
          <div className="bg-[#0A0A0F] border-2 border-[#2D273D] px-3 py-1.5 text-xs font-mono">
            <select
              value={selectedWorkflow}
              onChange={(e) => setSelectedWorkflow(e.target.value)}
              className="bg-transparent text-white font-bold uppercase tracking-wider outline-none cursor-pointer max-w-[200px]"
            >
              <option value="all" className="bg-black text-white">
                ALL WORKFLOWS
              </option>
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id} className="bg-black text-white">
                  {wf.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search by Run ID */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#8B5CF6] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={searchRunId}
            onChange={(e) => setSearchRunId(e.target.value)}
            placeholder="Search run ID or workflow..."
            className="w-full bg-[#0A0A0F] border-2 border-[#2D273D] pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#8B5CF6] transition-colors"
          />
        </div>
      </div>

      {/* Runs Table */}
      <div className="border-2 border-[#2D273D] bg-black overflow-hidden shadow-[4px_4px_0px_#000000] font-mono">
        {filteredRuns.length === 0 ? (
          <EmptyState
            title="No executions found"
            description="No workflow runs matched the selected filters."
            icon={<PlayCircle className="w-6 h-6 text-[#A78BFA]" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#050508] border-b-2 border-[#2D273D] text-white uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Run ID</th>
                  <th className="py-3 px-4">Workflow</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Started</th>
                  <th className="py-3 px-4">Trigger</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#2D273D]/60 bg-black">
                {filteredRuns.map((run) => {
                  const isTerminal = ["completed", "failed", "cancelled", "timed_out"].includes(
                    run.status
                  );
                  return (
                    <tr
                      key={run.id}
                      className="hover:bg-[#14101F] transition-colors group cursor-pointer"
                    >
                      <td className="py-3.5 px-4 text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/app/runs/${run.id}`}
                            className="font-medium text-[#F5F3FF] hover:text-[#A78BFA] transition-colors"
                          >
                            {truncateId(run.id, 8, 4)}
                          </Link>
                          <CopyButton value={run.id} />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-sans font-medium text-zinc-200">
                        <Link href={`/app/runs/${run.id}`} className="hover:text-[#A78BFA] transition-colors">
                          {run.workflowName || run.workflowKey}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1B1923] border border-[#292532]">
                          v{run.versionNumber || 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={run.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300">
                        {formatDuration(run.durationMs, run.startedAt, run.completedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        {formatRelativeTime(run.startedAt || run.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase bg-[#1B1923] border border-[#292532]">
                          {run.triggerType || "api"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Cancel button if running */}
                          {run.status === "running" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetRun(run);
                                setDialogAction("cancel");
                              }}
                              title="Cancel execution"
                              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#1B1923] border border-transparent hover:border-[#8B5CF6]/50 transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5 text-[#A78BFA]" />
                            </button>
                          )}

                          {/* Retry button if failed */}
                          {run.status === "failed" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetRun(run);
                                setDialogAction("retry");
                              }}
                              title="Retry run execution"
                              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#1B1923] border border-transparent hover:border-[#8B5CF6]/50 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-[#A78BFA]" />
                            </button>
                          )}

                          <Link
                            href={`/app/runs/${run.id}`}
                            className="px-2 py-1 rounded text-[11px] font-sans font-medium text-zinc-300 hover:text-white bg-[#1B1923] border border-[#292532] hover:bg-[#252230] transition-colors inline-flex items-center gap-1"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-[#0D0D12] border-t border-[#292532] flex items-center justify-between text-xs font-mono text-zinc-400">
          <div>
            Total executions: <span className="text-zinc-200">{pagination.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.offset === 0 || isLoading}
              onClick={() => loadData(Math.max(0, pagination.offset - pagination.limit))}
              className="p-1.5 rounded bg-[#14141B] border border-[#292532] disabled:opacity-40 hover:bg-[#1B1923] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>
              Page {Math.floor(pagination.offset / pagination.limit) + 1} of{" "}
              {Math.max(1, Math.ceil(pagination.total / pagination.limit))}
            </span>
            <button
              type="button"
              disabled={pagination.offset + pagination.limit >= pagination.total || isLoading}
              onClick={() => loadData(pagination.offset + pagination.limit)}
              className="p-1.5 rounded bg-[#14141B] border border-[#292532] disabled:opacity-40 hover:bg-[#1B1923] transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(dialogAction && targetRun)}
        title={dialogAction === "cancel" ? "Cancel Run Execution" : "Retry Failed Run"}
        description={
          dialogAction === "cancel"
            ? `Are you sure you want to cancel run ${targetRun?.id}? Active worker leases will be terminated immediately.`
            : `Retry will create a new execution cycle for run ${targetRun?.id} while preserving its revision history.`
        }
        confirmLabel={dialogAction === "cancel" ? "Cancel Run" : "Retry Run"}
        isDestructive={dialogAction === "cancel"}
        isLoading={isActionLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setDialogAction(null);
          setTargetRun(null);
        }}
      />
    </div>
  );
}
