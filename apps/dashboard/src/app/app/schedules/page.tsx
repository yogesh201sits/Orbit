"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Plus,
  RotateCw,
  Play,
  Pause,
  Trash2,
  Clock,
  Globe,
  AlertTriangle,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { api } from "@/lib/api/client";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { ScheduleItem, WorkflowItem } from "@/types/orbit";

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkflowId, setNewWorkflowId] = useState("");
  const [newCron, setNewCron] = useState("0 * * * *");
  const [newTimezone, setNewTimezone] = useState("UTC");
  const [newInput, setNewInput] = useState('{\n  "batch": true\n}');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Action / Delete Dialog
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [schedRes, wfRes] = await Promise.all([
        api.listSchedules(),
        api.listWorkflows(),
      ]);
      setSchedules(schedRes.data);
      setWorkflows(wfRes.data);
      if (wfRes.data.length > 0 && !newWorkflowId) {
        setNewWorkflowId(wfRes.data[0]?.id || "");
      }
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowId || !newCron.trim()) return;

    let parsedInput = {};
    try {
      if (newInput.trim()) {
        parsedInput = JSON.parse(newInput);
      }
    } catch {
      alert("Invalid JSON for schedule input payload.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createSchedule({
        workflowId: newWorkflowId,
        cronExpression: newCron.trim(),
        timezone: newTimezone.trim() || "UTC",
        input: parsedInput,
      });
      setIsCreateOpen(false);
      await loadData();
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePauseSchedule = async (schedule: ScheduleItem) => {
    const nextStatus = schedule.status === "active" ? "paused" : "active";
    try {
      await api.updateSchedule(schedule.id, { status: nextStatus });
      await loadData();
    } catch {
      // Handled
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api.deleteSchedule(deleteTargetId);
      setDeleteTargetId(null);
      await loadData();
    } catch {
      // Handled
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Cron-based and periodic execution schedules for durable workflows."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Schedules" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#14141B] hover:bg-[#1B1923] border border-[#292532] text-xs font-medium text-zinc-300 transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#8B5CF6]" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-medium text-white transition-colors shadow-[0_0_12px_rgba(139,92,246,0.25)]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Schedule</span>
            </button>
          </div>
        }
      />

      {/* Schedules Table */}
      <div className="rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden">
        {schedules.length === 0 ? (
          <EmptyState
            title="No scheduled workflows"
            description="Recurring triggers allow workflows to run on specified cron schedules automatically."
            icon={<CalendarClock className="w-6 h-6" />}
            action={
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-3 py-1.5 rounded-md bg-[#8B5CF6] text-xs font-medium text-white shadow-[0_0_12px_rgba(139,92,246,0.25)]"
              >
                Create First Schedule
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0D0D12] border-b border-[#292532] text-zinc-400 font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-medium">Workflow</th>
                  <th className="py-3 px-4 font-medium">Cron Expression</th>
                  <th className="py-3 px-4 font-medium">Timezone</th>
                  <th className="py-3 px-4 font-medium">Next Execution</th>
                  <th className="py-3 px-4 font-medium">Last Execution</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292532]/60 font-mono">
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-[#1B1923]/60 transition-colors">
                    <td className="py-3.5 px-4 font-sans font-medium text-[#F5F3FF]">
                      <Link
                        href={`/app/workflows/${schedule.workflowId}`}
                        className="hover:text-[#A78BFA] transition-colors"
                      >
                        {schedule.workflowName || schedule.workflowKey}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      <span className="px-2 py-0.5 rounded bg-[#0D0D12] border border-[#292532] text-[#A78BFA] font-mono">
                        {schedule.cronExpression || "interval"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">{schedule.timezone}</td>
                    <td className="py-3.5 px-4 text-emerald-400">
                      {formatRelativeTime(schedule.nextRunAt)}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      {schedule.lastRunAt ? formatRelativeTime(schedule.lastRunAt) : "never"}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={schedule.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => togglePauseSchedule(schedule)}
                          title={schedule.status === "active" ? "Pause schedule" : "Resume schedule"}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#1B1923] transition-colors"
                        >
                          {schedule.status === "active" ? (
                            <Pause className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(schedule.id)}
                          title="Delete schedule"
                          className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Schedule Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-lg border border-[#292532] bg-[#14141B] p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#292532]">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#8B5CF6]" />
                <h2 className="text-sm font-semibold text-[#F5F3FF]">Create Schedule</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Target Workflow</label>
                <select
                  value={newWorkflowId}
                  onChange={(e) => setNewWorkflowId(e.target.value)}
                  className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 font-mono outline-none focus:border-[#8B5CF6]"
                >
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id} className="bg-[#14141B]">
                      {wf.name} ({wf.key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Cron Expression (5-part)
                </label>
                <input
                  type="text"
                  required
                  placeholder="0 * * * *"
                  value={newCron}
                  onChange={(e) => setNewCron(e.target.value)}
                  className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 font-mono outline-none focus:border-[#8B5CF6]"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Example: <code>0 * * * *</code> (Hourly), <code>0 0 * * *</code> (Daily midnight)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Timezone</label>
                <input
                  type="text"
                  placeholder="UTC"
                  value={newTimezone}
                  onChange={(e) => setNewTimezone(e.target.value)}
                  className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 font-mono outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Default Input Payload (JSON)
                </label>
                <textarea
                  rows={4}
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                  className="w-full bg-[#0D0D12] border border-[#292532] rounded-md p-2.5 text-xs text-zinc-200 font-mono outline-none focus:border-[#8B5CF6] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#292532]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
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
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetId)}
        title="Delete Schedule"
        description="Are you sure you want to delete this schedule? Recurring runs will no longer be triggered for this workflow."
        confirmLabel="Delete Schedule"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteSchedule}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
