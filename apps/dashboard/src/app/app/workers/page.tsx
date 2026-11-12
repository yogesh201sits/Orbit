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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0F] hover:bg-[#14141B] border-2 border-[#2D273D] text-xs font-mono uppercase tracking-wider text-white transition-all shadow-[2px_2px_0px_#000000]"
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
          icon={<Server className="w-4 h-4 text-white" />}
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
          icon={<Layers className="w-4 h-4 text-white" />}
        />
        <MetricCard
          label="Processing Jobs"
          value={totalActiveJobs}
          subtext="Claimed queue leases"
          highlight
          icon={<Activity className="w-4 h-4 text-white" />}
        />
      </div>

      {/* Workers Grid */}
      <div className="border-2 border-[#2D273D] bg-black shadow-[4px_4px_0px_#000000] overflow-hidden">
        <div className="px-5 py-3.5 border-b-2 border-[#2D273D] bg-[#0A0A0F] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Worker Nodes</h2>
            <p className="text-xs font-mono text-[#A1A1AA]">
              Real-time heartbeat polling and lease-claiming agents
            </p>
          </div>
          <span className="text-xs font-mono text-[#A78BFA] font-bold">
            [{workers.length} INSTANCES]
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
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0A0A0F] border-b-2 border-[#2D273D] text-[#A1A1AA] uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-bold text-white">Worker Name / Host</th>
                  <th className="py-3 px-4 font-bold text-white">Status</th>
                  <th className="py-3 px-4 font-bold text-white">Assigned Queues</th>
                  <th className="py-3 px-4 font-bold text-white">Active Jobs / Concurrency</th>
                  <th className="py-3 px-4 font-bold text-white">Last Heartbeat</th>
                  <th className="py-3 px-4 font-bold text-white text-right">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D273D]">
                {workers.map((worker) => {
                  const isStale =
                    worker.status !== "active" ||
                    (worker.lastHeartbeat &&
                      Date.now() - new Date(worker.lastHeartbeat).getTime() > 30000);

                  return (
                    <tr key={worker.id} className="hover:bg-[#0A0A0F] transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{worker.name}</span>
                          <CopyButton value={worker.id} />
                        </div>
                        {worker.hostname && (
                          <div className="text-[11px] text-[#A1A1AA] mt-0.5">{worker.hostname}</div>
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
                              className="px-1.5 py-0.5 text-[10px] bg-[#050508] border border-[#2D273D] text-white font-mono"
                            >
                              {q}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-white">
                        <span className="font-bold text-[#C4B5FD]">
                          {worker.metadata?.activeJobs || 0}
                        </span>{" "}
                        /{" "}
                        <span className="text-[#A1A1AA]">
                          {worker.metadata?.concurrency || 64}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 ${
                              isStale ? "bg-[#2D273D]" : "bg-[#8B5CF6] shadow-[0_0_8px_#8B5CF6] animate-pulse"
                            }`}
                          />
                          <span>{formatRelativeTime(worker.lastHeartbeat)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-white">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#0A0A0F] border border-[#8B5CF6] text-[#A78BFA]">
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
