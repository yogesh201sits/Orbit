"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Search,
  RotateCw,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Database,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CopyButton } from "@/components/ui/CopyButton";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api/client";
import { formatDate, formatRelativeTime, truncateId } from "@/lib/formatting";
import type { WorkflowEventItem, WorkflowRunItem } from "@/types/orbit";

export default function EventsPage() {
  const [events, setEvents] = useState<WorkflowEventItem[]>([]);
  const [runs, setRuns] = useState<WorkflowRunItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const runsRes = await api.listRuns({ limit: 10 });
      setRuns(runsRes.data);

      // Collect events across recent runs
      const eventPromises = runsRes.data.map((r) => api.getRunEvents(r.id));
      const eventResults = await Promise.all(eventPromises);
      const combinedEvents = eventResults.flatMap((res) => res.data);
      combinedEvents.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setEvents(combinedEvents);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = events.filter((evt) => {
    if (selectedRunId !== "all" && evt.runId !== selectedRunId) return false;
    if (
      search &&
      !evt.type.toLowerCase().includes(search.toLowerCase()) &&
      !evt.id.toLowerCase().includes(search.toLowerCase()) &&
      !evt.runId.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Append-only event stream recording durable execution transitions."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Events" },
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Run Filter */}
          <div className="bg-[#0A0A0F] border-2 border-[#2D273D] px-3 py-1.5 text-xs font-mono shadow-[2px_2px_0px_#000000]">
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="bg-transparent text-white font-mono uppercase text-xs outline-none cursor-pointer max-w-[260px]"
            >
              <option value="all" className="bg-black text-white">
                All Execution Runs
              </option>
              {runs.map((r) => (
                <option key={r.id} value={r.id} className="bg-black text-white">
                  {r.workflowKey || r.workflowName} ({truncateId(r.id, 6, 4)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH EVENT TYPE, RUN ID..."
            className="w-full bg-[#0A0A0F] border-2 border-[#2D273D] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#A1A1AA] font-mono outline-none focus:border-[#8B5CF6] transition-all shadow-[2px_2px_0px_#000000]"
          />
        </div>
      </div>

      {/* Events Stream */}
      <div className="border-2 border-[#2D273D] bg-black shadow-[4px_4px_0px_#000000] overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title="No events found"
            description="No transition events matched the selected filter criteria."
            icon={<Activity className="w-6 h-6" />}
          />
        ) : (
          <div className="divide-y-2 divide-[#2D273D]">
            {filtered.map((evt) => {
              const isExpanded = expandedEventId === evt.id;
              return (
                <div key={evt.id} className="p-4 hover:bg-[#0A0A0F] transition-colors">
                  <div
                    onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="p-1 border border-[#2D273D] bg-[#050508] text-white">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#8B5CF6]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white" />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#C4B5FD] bg-[#050508] px-2.5 py-1 border border-[#8B5CF6]">
                          {evt.type}
                        </span>
                        <span className="font-mono text-xs text-[#A1A1AA] font-bold">
                          [SEQ #{evt.sequence}]
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-mono text-white truncate">
                        <span className="text-[#A1A1AA]">•</span>
                        <span className="text-[#A1A1AA]">Run:</span>
                        <Link
                          href={`/app/runs/${evt.runId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-[#A78BFA] hover:text-white transition-colors"
                        >
                          {truncateId(evt.runId, 8, 4)}
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-white shrink-0 self-end sm:self-center">
                      <span className="text-[#A1A1AA]">{formatRelativeTime(evt.createdAt)}</span>
                      <Link
                        href={`/app/runs/${evt.runId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 border border-[#2D273D] bg-[#050508] text-white hover:border-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
                        title="View run execution"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Expanded Payload Area */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t-2 border-[#2D273D]">
                      <JsonViewer
                        data={evt.payload}
                        title={`Payload for ${evt.type} (#${evt.sequence})`}
                        maxHeight="250px"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
