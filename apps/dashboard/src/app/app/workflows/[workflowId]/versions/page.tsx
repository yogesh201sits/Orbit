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
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-[#14101F] border-2 border-[#8B5CF6] text-xs font-mono font-bold uppercase tracking-wider text-white shadow-[2px_2px_0px_#8B5CF6] active:translate-x-[1px] active:translate-y-[1px] transition-all"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#8B5CF6]" : ""}`} />
            <span>Refresh</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono">
        {/* Version List Column */}
        <div className="border-2 border-[#2D273D] bg-black overflow-hidden shadow-[4px_4px_0px_#000000]">
          <div className="px-4 py-3 border-b-2 border-[#2D273D] bg-[#050508]">
            <h2 className="text-xs font-mono font-black uppercase tracking-wider text-white">
              Registered Versions ({versions.length})
            </h2>
          </div>

          <div className="divide-y-2 divide-[#2D273D]/60">
            {versions.map((ver) => {
              const isSelected = selectedVersion?.id === ver.id;
              return (
                <div
                  key={ver.id}
                  onClick={() => setSelectedVersion(ver)}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#14101F] border-l-4 border-l-[#8B5CF6]"
                      : "hover:bg-[#14101F]/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-sm font-black text-white uppercase tracking-wider">
                      Version {ver.version}
                    </span>
                    {ver.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 bg-black text-white border-2 border-white shadow-[2px_2px_0px_#8B5CF6] font-bold">
                        <Check className="w-3 h-3 text-[#A78BFA]" />
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold">
                        [Archived]
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-mono text-zinc-400 flex flex-col gap-1 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 uppercase">Executions:</span>
                      <span className="text-white font-bold">{ver.runsCount || 0} runs</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 uppercase">Registered:</span>
                      <span>{formatRelativeTime(ver.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Version Detail Pane */}
        <div className="lg:col-span-2 border-2 border-[#2D273D] bg-[#0A0A0F] p-5 flex flex-col gap-4 shadow-[4px_4px_0px_#000000]">
          {selectedVersion ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b-2 border-[#2D273D] gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white font-mono uppercase tracking-wider">
                      Workflow Definition v{selectedVersion.version}
                    </h2>
                    {selectedVersion.isActive && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-black text-white border border-white font-bold">
                        Default Active Version
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 font-mono">
                    // Registered on {formatDate(selectedVersion.createdAt)}
                  </p>
                </div>
              </div>

              {/* Checksum & Integrity Badge */}
              <div className="p-3 bg-black border-2 border-[#2D273D] flex items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2 truncate text-zinc-300">
                  <ShieldCheck className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                  <span className="text-zinc-500 uppercase font-bold shrink-0">Checksum:</span>
                  <span className="truncate text-white">{selectedVersion.checksum}</span>
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
