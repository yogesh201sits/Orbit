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
  KeyRound,
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
            <div className="flex items-center bg-black border-2 border-[#2D273D] p-0.5 text-xs font-mono">
              {(["1h", "24h", "7d", "30d"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 font-bold uppercase transition-all ${
                    timeRange === range
                      ? "bg-[#8B5CF6] text-white border-2 border-white shadow-[2px_2px_0px_#FFFFFF]"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            <Link
              href="/app/settings/api-keys"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] border-2 border-white text-xs font-mono font-bold uppercase tracking-wider text-white shadow-[2px_2px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>API Keys & SDK</span>
            </Link>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Refresh overview metrics"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-[#14101F] border-2 border-[#8B5CF6] text-xs font-mono font-bold uppercase tracking-wider text-white shadow-[2px_2px_0px_#8B5CF6] active:translate-x-[1px] active:translate-y-[1px] transition-all"
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
          icon={<Zap className="w-4 h-4 text-[#C4B5FD]" />}
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
          icon={<AlertTriangle className="w-4 h-4 text-zinc-300" />}
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
          icon={<Server className="w-4 h-4 text-white" />}
        />
      </div>

      {/* Activity Chart & Attention Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono">
        {/* Execution Activity Chart */}
        <div className="lg:col-span-2 border-2 border-[#2D273D] bg-[#0A0A0F] p-5 flex flex-col justify-between shadow-[4px_4px_0px_#000000]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#2D273D]">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Execution Volume
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">// Durable runs executed across all queues</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-white font-bold">
                <span className="w-2.5 h-2.5 bg-[#8B5CF6]" />
                SUCCESS
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400 font-bold">
                <span className="w-2.5 h-2.5 bg-[#292532] border border-white/40" />
                FAILED
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
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-black border-2 border-white text-[11px] font-mono font-bold px-2.5 py-1 shadow-[2px_2px_0px_#8B5CF6] whitespace-nowrap">
                      <div>TOTAL: {bar.total}</div>
                      <div className="text-white">OK: {bar.success}</div>
                      {bar.failed > 0 && <div className="text-zinc-400">ERR: {bar.failed}</div>}
                    </div>

                    <div className="w-full max-w-[42px] flex flex-col justify-end h-36 bg-black border-2 border-[#2D273D] overflow-hidden">
                      {failHeight > 0 && (
                        <div
                          style={{ height: `${failHeight}%` }}
                          className="w-full bg-[#292532] border-t-2 border-white/20 transition-all duration-150"
                        />
                      )}
                      <div
                        style={{ height: `${successHeight}%` }}
                        className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] transition-all duration-150 shadow-[0_0_8px_rgba(139,92,246,0.3)]"
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">{bar.timestamp}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Attention Section */}
        <div className="border-2 border-[#8B5CF6] bg-[#0A0A0F] p-5 flex flex-col shadow-[4px_4px_0px_#8B5CF6]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#2D273D]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#A78BFA]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-white">System Attention</h2>
            </div>
            <span className="text-xs font-mono font-bold text-[#A78BFA]">
              [{attentionRuns.length + unhealthyWorkers.length} ALERTS]
            </span>
          </div>

          <div className="mt-3 flex-1 flex flex-col gap-2.5 overflow-y-auto">
            {attentionRuns.length === 0 && unhealthyWorkers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 font-mono text-xs uppercase">
                <span>[ ALL SYSTEMS NORMAL ]</span>
              </div>
            ) : (
              <>
                {attentionRuns.map((run) => (
                  <Link
                    key={run.id}
                    href={`/app/runs/${run.id}`}
                    className="p-3 bg-black border-2 border-[#2D273D] hover:border-[#8B5CF6] hover:shadow-[3px_3px_0px_#8B5CF6] transition-all flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="truncate font-mono">
                      <div className="font-bold text-white uppercase truncate">{run.workflowName || run.workflowKey}</div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        // {run.error?.message || "Execution error"}
                      </div>
                    </div>
                    <StatusBadge status={run.status} size="sm" />
                  </Link>
                ))}

                {unhealthyWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="p-3 bg-black border-2 border-[#2D273D] flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="truncate font-mono">
                      <div className="font-bold text-white uppercase truncate">{worker.name}</div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        // Stalled: {formatRelativeTime(worker.lastHeartbeat)}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono">
        {/* Recent Executions Table */}
        <div className="lg:col-span-2 border-2 border-[#2D273D] bg-[#0A0A0F] overflow-hidden shadow-[4px_4px_0px_#000000]">
          <div className="px-5 py-3.5 border-b-2 border-[#2D273D] bg-black flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Recent Executions</h2>
              <p className="text-xs text-zinc-400">// Latest workflow instances</p>
            </div>
            <Link
              href="/app/runs"
              className="text-xs font-bold uppercase tracking-wider text-[#A78BFA] hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>View all runs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#050508] border-b-2 border-[#2D273D] text-white uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Workflow</th>
                  <th className="py-3 px-4">Run ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Started</th>
                  <th className="py-3 px-4 text-right">Trigger</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#2D273D]/60 bg-black">
                {recentRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-[#14101F] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-bold text-white truncate max-w-[160px]">
                      <Link href={`/app/runs/${run.id}`} className="hover:text-[#A78BFA] transition-colors block truncate uppercase">
                        {run.workflowName || run.workflowKey}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      <div className="flex items-center gap-1">
                        <Link href={`/app/runs/${run.id}`} className="hover:text-white">
                          {truncateId(run.id, 8, 4)}
                        </Link>
                        <CopyButton value={run.id} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={run.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-white font-bold">
                      {formatDuration(run.durationMs, run.startedAt, run.completedAt)}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {formatRelativeTime(run.startedAt || run.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-[#14101F] border border-[#2D273D] text-white">
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
        <div className="border-2 border-[#2D273D] bg-[#0A0A0F] overflow-hidden flex flex-col shadow-[4px_4px_0px_#000000]">
          <div className="px-5 py-3.5 border-b-2 border-[#2D273D] bg-black flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Workers Health</h2>
              <p className="text-xs text-zinc-400">// Active executor fleet</p>
            </div>
            <Link
              href="/app/workers"
              className="text-xs font-bold uppercase tracking-wider text-[#A78BFA] hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 flex-1 flex flex-col gap-3">
            {workers.slice(0, 4).map((worker) => (
              <div
                key={worker.id}
                className="p-3 border-2 border-[#2D273D] bg-black flex flex-col gap-2 shadow-[2px_2px_0px_#000000]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <Server className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                    <span className="font-mono text-xs font-bold text-white uppercase truncate">{worker.name}</span>
                  </div>
                  <StatusBadge status={worker.status} size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400 pt-1.5 border-t border-[#2D273D]">
                  <div>
                    <span className="text-zinc-500 uppercase">Jobs: </span>
                    <span className="text-white font-bold">
                      {worker.metadata?.activeJobs || 0} / {worker.metadata?.concurrency || 64}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-zinc-500 uppercase">Ping: </span>
                    <span className="text-zinc-300 font-bold">{formatRelativeTime(worker.lastHeartbeat)}</span>
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
