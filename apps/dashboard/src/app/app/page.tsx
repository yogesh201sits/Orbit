"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  PlayCircle,
  AlertTriangle,
  RotateCw,
  Server,
  GitFork,
  Activity,
  ArrowUpRight,
  Clock,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { api } from "@/lib/api/client";
import { formatDate, formatDuration, formatRelativeTime, truncateId } from "@/lib/formatting";
import type { OverviewMetrics, WorkflowRunItem, WorkerItem } from "@/types/orbit";

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [recentRuns, setRecentRuns] = useState<WorkflowRunItem[]>([]);
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveApi, setIsLiveApi] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [metricsRes, runsRes, workersRes] = await Promise.all([
        api.getOverviewMetrics(),
        api.listRuns({ limit: 6 }),
        api.listWorkers(),
      ]);

      setMetrics(metricsRes.data);
      setRecentRuns(runsRes.data);
      setWorkers(workersRes.data);
      setIsLiveApi(metricsRes.isLive || runsRes.isLive);
    } catch {
      // Handled by api client fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const attentionRuns = recentRuns.filter(
    (r) => r.status === "failed" || r.status === "timed_out"
  );
  const unhealthyWorkers = workers.filter((w) => w.status !== "active");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Monitor your workflows and execution infrastructure."
        actions={
          <div className="flex items-center gap-2">
            {/* Time Range Selector */}
            <div className="flex items-center bg-[#14141B] border border-[#292532] rounded-md p-0.5 text-xs font-mono">
              {(["1h", "24h", "7d", "30d"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 rounded transition-colors ${
                    timeRange === range
                      ? "bg-[#1B1923] text-[#A78BFA] font-semibold border border-[#8B5CF6]/30"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Refresh overview metrics"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#14141B] hover:bg-[#1B1923] border border-[#292532] text-xs font-medium text-zinc-300 transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#8B5CF6]" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Total runs"
          value={metrics ? metrics.totalRuns.toLocaleString() : "..."}
          subtext={`Past ${timeRange}`}
          icon={<PlayCircle className="w-4 h-4 text-[#8B5CF6]" />}
        />
        <MetricCard
          label="Success rate"
          value={metrics ? `${metrics.successRate}%` : "..."}
          subtext="Target: >98%"
          highlight
          icon={<Zap className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          label="Running"
          value={metrics ? metrics.runningExecutions : "..."}
          subtext="Active execution leases"
          icon={<Activity className="w-4 h-4 text-[#8B5CF6]" />}
        />
        <MetricCard
          label="Failed runs"
          value={metrics ? metrics.failedRuns : "..."}
          subtext="Requires inspection"
          icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
        />
        <MetricCard
          label="Workflows"
          value={metrics ? metrics.registeredWorkflows : "..."}
          subtext="Registered definitions"
          icon={<GitFork className="w-4 h-4 text-zinc-400" />}
        />
        <MetricCard
          label="Active workers"
          value={metrics ? String(metrics.activeWorkers).padStart(2, "0") : "..."}
          subtext="Polling job queues"
          icon={<Server className="w-4 h-4 text-emerald-400" />}
        />
      </div>

      {/* Activity Chart & Attention Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution Activity Chart */}
        <div className="lg:col-span-2 rounded-lg border border-[#292532] bg-[#14141B] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-[#292532]/60">
            <div>
              <h2 className="text-sm font-semibold text-[#F5F3FF]">Execution Volume</h2>
              <p className="text-xs text-[#A1A1AA] mt-0.5">Durable runs executed across all queues</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" />
                Successful
              </span>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                Failed
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="pt-6 pb-2">
            <div className="h-44 flex items-end justify-between gap-3 px-2">
              {metrics?.chartData.map((bar) => {
                const total = bar.total;
                const max = 1800;
                const totalHeight = Math.max(12, Math.round((total / max) * 100));
                const failHeight = Math.round((bar.failed / total) * totalHeight);
                const successHeight = totalHeight - failHeight;

                return (
                  <div key={bar.timestamp} className="flex-1 flex flex-col items-center gap-2 group relative">
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-[#0D0D12] border border-[#292532] text-[11px] font-mono px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      <div>Total: {bar.total}</div>
                      <div className="text-emerald-400">Success: {bar.success}</div>
                      {bar.failed > 0 && <div className="text-rose-400">Failed: {bar.failed}</div>}
                    </div>

                    <div className="w-full max-w-[42px] flex flex-col justify-end h-36 bg-[#1B1923]/40 rounded-t overflow-hidden">
                      {failHeight > 0 && (
                        <div
                          style={{ height: `${failHeight}%` }}
                          className="w-full bg-rose-500/90 transition-all duration-300"
                        />
                      )}
                      <div
                        style={{ height: `${successHeight}%` }}
                        className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] transition-all duration-300 shadow-[0_0_8px_rgba(139,92,246,0.25)]"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{bar.timestamp}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Attention Section */}
        <div className="rounded-lg border border-[#292532] bg-[#14141B] p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#292532]/60">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-[#F5F3FF]">System Attention</h2>
            </div>
            <span className="text-xs font-mono text-zinc-500">
              {attentionRuns.length + unhealthyWorkers.length} items
            </span>
          </div>

          <div className="mt-3 flex-1 flex flex-col gap-2.5 overflow-y-auto">
            {attentionRuns.length === 0 && unhealthyWorkers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                <span className="text-xs">All executions and workers are healthy.</span>
              </div>
            ) : (
              <>
                {attentionRuns.map((run) => (
                  <Link
                    key={run.id}
                    href={`/app/runs/${run.id}`}
                    className="p-2.5 rounded-md bg-[#1B1923] border border-rose-900/30 hover:border-rose-700/50 transition-colors flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="truncate">
                      <div className="font-medium text-rose-300 truncate">{run.workflowName || run.workflowKey}</div>
                      <div className="font-mono text-[11px] text-zinc-500 truncate mt-0.5">
                        {run.error?.message || "Execution error"}
                      </div>
                    </div>
                    <StatusBadge status={run.status} size="sm" />
                  </Link>
                ))}

                {unhealthyWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="p-2.5 rounded-md bg-[#1B1923] border border-amber-900/30 flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="truncate">
                      <div className="font-medium text-amber-300 truncate">{worker.name}</div>
                      <div className="font-mono text-[11px] text-zinc-500 truncate mt-0.5">
                        Heartbeat stalled ({formatRelativeTime(worker.lastHeartbeat)})
                      </div>
                    </div>
                    <StatusBadge status={worker.status} size="sm" />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent Executions & Worker Health Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Executions Table */}
        <div className="lg:col-span-2 rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#292532] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#F5F3FF]">Recent Executions</h2>
              <p className="text-xs text-[#A1A1AA]">Latest workflow instances</p>
            </div>
            <Link
              href="/app/runs"
              className="text-xs font-mono text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-1 transition-colors"
            >
              <span>View all runs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0D0D12] border-b border-[#292532] text-zinc-400 font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Workflow</th>
                  <th className="py-2.5 px-4 font-medium">Run ID</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Duration</th>
                  <th className="py-2.5 px-4 font-medium">Started</th>
                  <th className="py-2.5 px-4 font-medium text-right">Trigger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292532]/60 font-mono">
                {recentRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-[#1B1923]/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-sans font-medium text-[#F5F3FF] truncate max-w-[160px]">
                      <Link href={`/app/runs/${run.id}`} className="hover:text-[#A78BFA] transition-colors block truncate">
                        {run.workflowName || run.workflowKey}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Link href={`/app/runs/${run.id}`} className="hover:text-zinc-200">
                          {truncateId(run.id, 8, 4)}
                        </Link>
                        <CopyButton value={run.id} />
                      </div>
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
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase bg-[#1B1923] border border-[#292532] text-zinc-400">
                        {run.triggerType || "api"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Worker Health List */}
        <div className="rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-[#292532] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#F5F3FF]">Workers Health</h2>
              <p className="text-xs text-[#A1A1AA]">Active executor fleet</p>
            </div>
            <Link
              href="/app/workers"
              className="text-xs font-mono text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 flex-1 flex flex-col gap-3">
            {workers.slice(0, 4).map((worker) => (
              <div
                key={worker.id}
                className="p-3 rounded-md border border-[#292532] bg-[#0D0D12] flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <Server className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="font-mono text-xs font-medium text-zinc-200 truncate">{worker.name}</span>
                  </div>
                  <StatusBadge status={worker.status} size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 pt-1 border-t border-[#292532]/50">
                  <div>
                    <span className="text-zinc-500">Jobs: </span>
                    <span className="text-zinc-200">
                      {worker.metadata?.activeJobs || 0} / {worker.metadata?.concurrency || 64}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500">Heartbeat: </span>
                    <span className="text-zinc-300">{formatRelativeTime(worker.lastHeartbeat)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
