"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  RotateCw,
  Cpu,
  Activity,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api/client";
import { formatDate, formatRelativeTime, truncateId } from "@/lib/formatting";
import type { WorkerItem } from "@/types/orbit";

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await api.listWorkers();
      setWorkers(res.data);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeWorkers = workers.filter((w) => w.status === "active");
  const totalConcurrency = workers.reduce(
    (acc, w) => acc + (w.metadata?.concurrency || 64),
    0
  );
  const totalActiveJobs = workers.reduce(
    (acc, w) => acc + (w.metadata?.activeJobs || 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description="Monitor executor nodes and queue polling fleets across your clusters."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Workers" },
        ]}
        actions={
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#14141B] hover:bg-[#1B1923] border border-[#292532] text-xs font-medium text-zinc-300 transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#8B5CF6]" : ""}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Active Fleet"
          value={String(activeWorkers.length).padStart(2, "0")}
          subtext="Healthy heartbeats"
          icon={<Server className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          label="Total Nodes"
          value={workers.length}
          subtext="Registered worker pods"
          icon={<Cpu className="w-4 h-4 text-[#8B5CF6]" />}
        />
        <MetricCard
          label="Fleet Concurrency"
          value={totalConcurrency}
          subtext="Max concurrent jobs"
          icon={<Layers className="w-4 h-4 text-zinc-400" />}
        />
        <MetricCard
          label="Processing Jobs"
          value={totalActiveJobs}
          subtext="Claimed queue leases"
          highlight
          icon={<Activity className="w-4 h-4 text-[#8B5CF6]" />}
        />
      </div>

      {/* Workers Grid */}
      <div className="rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#292532] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#F5F3FF]">Worker Nodes</h2>
            <p className="text-xs text-[#A1A1AA]">
              Real-time heartbeat polling and lease-claiming agents
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            {workers.length} registered instances
          </span>
        </div>

        {workers.length === 0 ? (
          <EmptyState
            title="No worker nodes detected"
            description="Start worker processes using the Orbit SDK to begin polling execution queues."
            icon={<Server className="w-6 h-6" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0D0D12] border-b border-[#292532] text-zinc-400 font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-medium">Worker Name / Host</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Assigned Queues</th>
                  <th className="py-3 px-4 font-medium">Active Jobs / Concurrency</th>
                  <th className="py-3 px-4 font-medium">Last Heartbeat</th>
                  <th className="py-3 px-4 font-medium text-right">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292532]/60 font-mono">
                {workers.map((worker) => {
                  const isStale =
                    worker.status !== "active" ||
                    (worker.lastHeartbeat &&
                      Date.now() - new Date(worker.lastHeartbeat).getTime() > 30000);

                  return (
                    <tr key={worker.id} className="hover:bg-[#1B1923]/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#F5F3FF]">{worker.name}</span>
                          <CopyButton value={worker.id} />
                        </div>
                        {worker.hostname && (
                          <div className="text-[11px] text-zinc-500 mt-0.5">{worker.hostname}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={worker.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {worker.queues.map((q) => (
                            <span
                              key={q}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-[#0D0D12] border border-[#292532] text-zinc-300"
                            >
                              {q}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300">
                        <span className="font-semibold text-white">
                          {worker.metadata?.activeJobs || 0}
                        </span>{" "}
                        /{" "}
                        <span className="text-zinc-500">
                          {worker.metadata?.concurrency || 64}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isStale ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
                            }`}
                          />
                          <span>{formatRelativeTime(worker.lastHeartbeat)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-zinc-400">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1B1923] border border-[#292532]">
                          v{worker.metadata?.version || "0.1.0"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
