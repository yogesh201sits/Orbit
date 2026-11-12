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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0F] hover:bg-[#14141B] border-2 border-[#2D273D] text-xs font-mono uppercase tracking-wider text-white transition-all shadow-[2px_2px_0px_#000000]"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#8B5CF6]" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-mono font-bold uppercase tracking-wider text-white border-2 border-white transition-all shadow-[3px_3px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Schedule</span>
            </button>
          </div>
        }
      />

      {/* Schedules Table */}
      <div className="border-2 border-[#2D273D] bg-black shadow-[4px_4px_0px_#000000] overflow-hidden">
        {schedules.length === 0 ? (
          <EmptyState
            title="No scheduled workflows"
            description="Recurring triggers allow workflows to run on specified cron schedules automatically."
            icon={<CalendarClock className="w-6 h-6" />}
            action={
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-3 py-1.5 bg-[#8B5CF6] text-xs font-mono font-bold uppercase tracking-wider text-white border-2 border-white shadow-[2px_2px_0px_#000000]"
              >
                Create First Schedule
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0A0A0F] border-b-2 border-[#2D273D] text-[#A1A1AA] uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-bold text-white">Workflow</th>
                  <th className="py-3 px-4 font-bold text-white">Cron Expression</th>
                  <th className="py-3 px-4 font-bold text-white">Timezone</th>
                  <th className="py-3 px-4 font-bold text-white">Next Execution</th>
                  <th className="py-3 px-4 font-bold text-white">Last Execution</th>
                  <th className="py-3 px-4 font-bold text-white">Status</th>
                  <th className="py-3 px-4 font-bold text-white text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D273D]">
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-[#0A0A0F] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      <Link
                        href={`/app/workflows/${schedule.workflowId}`}
                        className="hover:text-[#A78BFA] transition-colors"
                      >
                        {schedule.workflowName || schedule.workflowKey}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-white">
                      <span className="px-2 py-0.5 bg-[#050508] border border-[#8B5CF6] text-[#C4B5FD] font-mono font-bold">
                        {schedule.cronExpression || "interval"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A1AA]">{schedule.timezone}</td>
                    <td className="py-3.5 px-4 text-[#C4B5FD] font-bold">
                      {formatRelativeTime(schedule.nextRunAt)}
                    </td>
                    <td className="py-3.5 px-4 text-[#A1A1AA]">
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
                          className="p-1.5 border border-[#2D273D] bg-[#0A0A0F] text-white hover:text-[#A78BFA] hover:border-[#8B5CF6] transition-colors"
                        >
                          {schedule.status === "active" ? (
                            <Pause className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Play className="w-3.5 h-3.5 text-[#A78BFA] fill-current" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(schedule.id)}
                          title="Delete schedule"
                          className="p-1.5 border border-[#2D273D] bg-[#0A0A0F] text-white hover:bg-[#8B5CF6] hover:border-white transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="w-full max-w-md border-2 border-[#8B5CF6] bg-[#0A0A0F] p-5 shadow-[6px_6px_0px_#8B5CF6] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#2D273D]">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#8B5CF6]" />
                <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Create Schedule</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-[#A1A1AA] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-white mb-1">Target Workflow</label>
                <select
                  value={newWorkflowId}
                  onChange={(e) => setNewWorkflowId(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#8B5CF6]"
                >
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id} className="bg-black text-white">
                      {wf.name} ({wf.key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-white mb-1">
                  Cron Expression (5-part)
                </label>
                <input
                  type="text"
                  required
                  placeholder="0 * * * *"
                  value={newCron}
                  onChange={(e) => setNewCron(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#8B5CF6]"
                />
                <span className="text-[10px] font-mono text-[#A1A1AA] mt-1 block">
                  Example: <code>0 * * * *</code> (Hourly), <code>0 0 * * *</code> (Daily midnight)
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-white mb-1">Timezone</label>
                <input
                  type="text"
                  placeholder="UTC"
                  value={newTimezone}
                  onChange={(e) => setNewTimezone(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-white mb-1">
                  Default Input Payload (JSON)
                </label>
                <textarea
                  rows={4}
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] p-2.5 text-xs text-white font-mono outline-none focus:border-[#8B5CF6] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-[#2D273D]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-bold text-white bg-black border-2 border-[#2D273D] hover:bg-[#14141B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-mono uppercase tracking-wider font-bold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-white shadow-[2px_2px_0px_#000000] flex items-center gap-1.5"
                >
                  {isSubmitting && <span className="w-3 h-3 border-2 border-white/40 border-t-white animate-spin" />}
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
