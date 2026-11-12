"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  GitFork,
  Search,
  Plus,
  RotateCw,
  Play,
  ArrowRight,
  X,
  Layers,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api/client";
import { formatDate, formatRelativeTime, truncateId } from "@/lib/formatting";
import type { WorkflowItem } from "@/types/orbit";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regKey, setRegKey] = useState("");
  const [regName, setRegName] = useState("");
  const [regTeam, setRegTeam] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      const res = await api.listWorkflows();
      setWorkflows(res.data);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regKey.trim() || !regName.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createWorkflow({
        key: regKey.trim(),
        name: regName.trim(),
        metadata: regTeam.trim() ? { team: regTeam.trim() } : undefined,
      });
      setIsRegisterOpen(false);
      setRegKey("");
      setRegName("");
      setRegTeam("");
      await loadWorkflows();
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Manage registered workflow definitions and versions."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Workflows" },
        ]}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadWorkflows}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-[#14101F] border-2 border-[#8B5CF6] text-xs font-mono font-bold uppercase tracking-wider text-white shadow-[2px_2px_0px_#8B5CF6] active:translate-x-[1px] active:translate-y-[1px] transition-all"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#8B5CF6]" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRegisterOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-mono font-black uppercase tracking-wider text-white border-2 border-white shadow-[3px_3px_0px_#FFFFFF] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Workflow</span>
            </button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8B5CF6] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by workflow name or key..."
            className="w-full bg-[#0A0A0F] border-2 border-[#2D273D] pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#8B5CF6] transition-colors"
          />
        </div>

        <div className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 self-end sm:self-center">
          Showing {filtered.length} of {workflows.length} workflows
        </div>
      </div>

      {/* Workflow Registry Table */}
      <div className="border-2 border-[#2D273D] bg-black overflow-hidden shadow-[4px_4px_0px_#000000] font-mono">
        {filtered.length === 0 ? (
          <EmptyState
            title="No workflows found"
            description={
              search
                ? `No workflows matched "${search}". Try adjusting your query.`
                : "No workflows have been registered yet in this project."
            }
            action={
              !search && (
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(true)}
                  className="px-4 py-2 bg-[#8B5CF6] text-xs font-bold uppercase tracking-wider text-white border-2 border-white shadow-[3px_3px_0px_#FFFFFF]"
                >
                  Register first workflow
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#050508] border-b-2 border-[#2D273D] text-white uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Workflow</th>
                  <th className="py-3 px-4">Key / Identifier</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Total Runs</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#2D273D]/60 bg-black">
                {filtered.map((wf) => (
                  <tr
                    key={wf.id}
                    className="hover:bg-[#14101F] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-bold text-white">
                      <Link href={`/app/workflows/${wf.id}`} className="block">
                        <div className="group-hover:text-[#A78BFA] transition-colors uppercase">
                          {wf.name}
                        </div>
                        {wf.metadata && typeof wf.metadata === "object" && (wf.metadata as any).team && (
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            // team: {(wf.metadata as any).team}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{wf.key}</span>
                        <CopyButton value={wf.key} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-black bg-[#14101F] border border-[#8B5CF6] text-[#A78BFA]">
                        v{wf.latestVersion || 1}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-white font-bold">
                      {wf.runsCount?.toLocaleString() ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {formatRelativeTime(wf.updatedAt || wf.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/app/workflows/${wf.id}`}
                          className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-white bg-black border-2 border-[#2D273D] hover:border-[#8B5CF6] hover:shadow-[2px_2px_0px_#8B5CF6] transition-all inline-flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3 text-[#8B5CF6]" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Workflow Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="w-full max-w-md border-2 border-[#8B5CF6] bg-[#0A0A0F] p-6 shadow-[6px_6px_0px_#8B5CF6] flex flex-col gap-4 animate-in zoom-in-95 duration-100 font-mono">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#2D273D]">
              <div className="flex items-center gap-2">
                <GitFork className="w-4 h-4 text-[#8B5CF6]" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">Register Workflow</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="text-zinc-400 hover:text-white p-1 hover:bg-[#151120] border border-transparent hover:border-[#8B5CF6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">Workflow Key (Slug)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. order-fulfillment"
                  value={regKey}
                  onChange={(e) => setRegKey(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] px-3 py-2 text-xs text-white outline-none focus:border-[#8B5CF6]"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  // Programmatic key identifier in SDK workflow definition.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Order Fulfillment Pipeline"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] px-3 py-2 text-xs text-white outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1">Team / Category</label>
                <input
                  type="text"
                  placeholder="e.g. ecommerce"
                  value={regTeam}
                  onChange={(e) => setRegTeam(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] px-3 py-2 text-xs text-white outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#2D273D]">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
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
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
