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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#14141B] hover:bg-[#1B1923] border border-[#292532] text-xs font-medium text-zinc-300 transition-colors"
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
          <div className="bg-[#14141B] border border-[#292532] rounded-md px-2.5 py-1.5 text-xs font-mono">
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="bg-transparent text-zinc-200 outline-none cursor-pointer max-w-[220px]"
            >
              <option value="all" className="bg-[#14141B]">
                All Execution Runs
              </option>
              {runs.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#14141B]">
                  {r.workflowKey || r.workflowName} ({truncateId(r.id, 6, 4)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event type, run ID..."
            className="w-full bg-[#14141B] border border-[#292532] rounded-md pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#8B5CF6] transition-colors"
          />
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title="No events found"
            description="No transition events matched the selected filter criteria."
            icon={<Activity className="w-6 h-6" />}
          />
        ) : (
          <div className="divide-y divide-[#292532]/60">
            {filtered.map((evt) => {
              const isExpanded = expandedEventId === evt.id;
              return (
                <div key={evt.id} className="p-4 hover:bg-[#1B1923]/40 transition-colors">
                  <div
                    onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="p-1 rounded text-zinc-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#8B5CF6]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#A78BFA] bg-[#1B1923] px-2 py-0.5 rounded border border-[#8B5CF6]/30">
                          {evt.type}
                        </span>
                        <span className="font-mono text-xs text-zinc-500">
                          Seq #{evt.sequence}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 truncate">
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-500">Run:</span>
                        <Link
                          href={`/app/runs/${evt.runId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-white transition-colors"
                        >
                          {truncateId(evt.runId, 8, 4)}
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 shrink-0 self-end sm:self-center">
                      <span>{formatRelativeTime(evt.createdAt)}</span>
                      <Link
                        href={`/app/runs/${evt.runId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                        title="View run execution"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Expanded Payload Area */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#292532]/60 animate-in fade-in duration-100">
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
