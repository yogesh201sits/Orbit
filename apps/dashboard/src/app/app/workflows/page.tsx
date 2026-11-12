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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadWorkflows}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#14141B] hover:bg-[#1B1923] border border-[#292532] text-xs font-medium text-zinc-300 transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#8B5CF6]" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRegisterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-medium text-white transition-colors shadow-[0_0_12px_rgba(139,92,246,0.25)]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Workflow</span>
            </button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by workflow name or key..."
            className="w-full bg-[#14141B] border border-[#292532] rounded-md pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#8B5CF6] transition-colors"
          />
        </div>

        <div className="text-xs font-mono text-zinc-500 self-end sm:self-center">
          Showing {filtered.length} of {workflows.length} workflows
        </div>
      </div>

      {/* Workflow Registry Table */}
      <div className="rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden">
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
                  className="px-3 py-1.5 rounded-md bg-[#8B5CF6] text-xs font-medium text-white shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                >
                  Register first workflow
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0D0D12] border-b border-[#292532] text-zinc-400 font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-medium">Workflow</th>
                  <th className="py-3 px-4 font-medium">Key / Identifier</th>
                  <th className="py-3 px-4 font-medium">Version</th>
                  <th className="py-3 px-4 font-medium">Total Runs</th>
                  <th className="py-3 px-4 font-medium">Updated</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292532]/60">
                {filtered.map((wf) => (
                  <tr
                    key={wf.id}
                    className="hover:bg-[#1B1923]/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <Link href={`/app/workflows/${wf.id}`} className="block">
                        <div className="font-medium text-[#F5F3FF] group-hover:text-[#A78BFA] transition-colors">
                          {wf.name}
                        </div>
                        {wf.metadata && typeof wf.metadata === "object" && (wf.metadata as any).team && (
                          <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                            team: {(wf.metadata as any).team}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <span>{wf.key}</span>
                        <CopyButton value={wf.key} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-[#1B1923] border border-[#292532] text-[#A78BFA]">
                        v{wf.latestVersion || 1}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-300">
                      {wf.runsCount?.toLocaleString() ?? 0}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-400">
                      {formatRelativeTime(wf.updatedAt || wf.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/app/workflows/${wf.id}`}
                          className="px-2.5 py-1 rounded text-xs font-medium text-zinc-300 hover:text-white bg-[#1B1923] border border-[#292532] hover:bg-[#252230] transition-colors inline-flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-lg border border-[#292532] bg-[#14141B] p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#292532]">
              <div className="flex items-center gap-2">
                <GitFork className="w-4 h-4 text-[#8B5CF6]" />
                <h2 className="text-sm font-semibold text-[#F5F3FF]">Register Workflow</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Workflow Key (Slug)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. order-fulfillment"
                  value={regKey}
                  onChange={(e) => setRegKey(e.target.value)}
                  className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 font-mono outline-none focus:border-[#8B5CF6]"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Unique programmatic identifier matching the SDK workflow definition.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Order Fulfillment Pipeline"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Team / Category (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ecommerce"
                  value={regTeam}
                  onChange={(e) => setRegTeam(e.target.value)}
                  className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#292532]">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-300 rounded-md bg-[#1B1923] border border-[#292532]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(139,92,246,0.25)] flex items-center gap-1.5"
                >
                  {isSubmitting && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
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
