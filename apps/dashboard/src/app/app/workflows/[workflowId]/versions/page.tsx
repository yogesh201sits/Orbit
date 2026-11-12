"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  History,
  Layers,
  Check,
  CheckCircle2,
  Clock,
  RotateCw,
  FileCode,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { JsonViewer } from "@/components/ui/JsonViewer";
import { api } from "@/lib/api/client";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { WorkflowItem, WorkflowVersionItem } from "@/types/orbit";

export const dynamic = "force-dynamic";

export default function WorkflowVersionsPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const resolvedParams = use(params);
  const workflowId = resolvedParams.workflowId;

  const [workflow, setWorkflow] = useState<WorkflowItem | null>(null);
  const [versions, setVersions] = useState<WorkflowVersionItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<WorkflowVersionItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [wfRes, verRes] = await Promise.all([
        api.getWorkflow(workflowId),
        api.listWorkflowVersions(workflowId),
      ]);
      setWorkflow(wfRes.data);
      setVersions(verRes.data);
      if (verRes.data.length > 0) {
        setSelectedVersion(verRes.data[0] || null);
      }
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workflowId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Versions: ${workflow?.name || workflowId}`}
        description="Immutable versions registered for this workflow. Durable runs retain their original registration version."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Workflows", href: "/app/workflows" },
          { label: workflow?.key || workflowId, href: `/app/workflows/${workflowId}` },
          { label: "Versions" },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Version List Column */}
        <div className="rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#292532] bg-[#0D0D12]">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
              Registered Versions ({versions.length})
            </h2>
          </div>

          <div className="divide-y divide-[#292532]/60">
            {versions.map((ver) => {
              const isSelected = selectedVersion?.id === ver.id;
              return (
                <div
                  key={ver.id}
                  onClick={() => setSelectedVersion(ver)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#1B1923] border-l-2 border-l-[#8B5CF6]"
                      : "hover:bg-[#1B1923]/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-sm font-bold text-[#F5F3FF]">
                      Version {ver.version}
                    </span>
                    {ver.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase text-zinc-500">
                        Archived
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-mono text-zinc-400 flex flex-col gap-1 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Executions:</span>
                      <span className="text-zinc-200">{ver.runsCount || 0} runs</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Registered:</span>
                      <span>{formatRelativeTime(ver.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Version Detail Pane */}
        <div className="lg:col-span-2 rounded-lg border border-[#292532] bg-[#14141B] p-5 flex flex-col gap-4">
          {selectedVersion ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#292532] gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-[#F5F3FF] font-mono">
                      Workflow Definition v{selectedVersion.version}
                    </h2>
                    {selectedVersion.isActive && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                        Default Active Version
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Registered on {formatDate(selectedVersion.createdAt)}
                  </p>
                </div>
              </div>

              {/* Checksum & Integrity Badge */}
              <div className="p-3 rounded-md bg-[#0D0D12] border border-[#292532] flex items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2 truncate text-zinc-400">
                  <ShieldCheck className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                  <span className="text-zinc-500 shrink-0">Checksum:</span>
                  <span className="truncate text-zinc-300">{selectedVersion.checksum}</span>
                </div>
                <CopyButton value={selectedVersion.checksum} />
              </div>

              {/* Version Definition JSON */}
              <div className="flex-1">
                <h3 className="text-xs font-mono font-medium text-zinc-400 mb-2">
                  Definition Graph & AST
                </h3>
                <JsonViewer
                  data={selectedVersion.definition}
                  title={`v${selectedVersion.version} definition`}
                  maxHeight="500px"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
              Select a version to inspect its immutable AST definition.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
