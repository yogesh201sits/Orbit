"use client";

import React, { useState } from "react";
import { Building2, Save, Layers, Clock, Globe } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";

export default function GeneralSettingsPage() {
  const [projectName, setProjectName] = useState("Acme Retail Infrastructure");
  const [slug, setSlug] = useState("acme-retail");
  const [defaultEnv, setDefaultEnv] = useState("production");
  const [timezone, setTimezone] = useState("UTC");
  const [saved, setSaved] = useState(false);

  const tenantId = "00000000-0000-0000-0000-000000000001";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#292532] bg-[#14141B] p-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#292532]">
          <Building2 className="w-4 h-4 text-[#8B5CF6]" />
          <h2 className="text-sm font-semibold text-[#F5F3FF]">Project Profile</h2>
        </div>

        <form onSubmit={handleSave} className="mt-4 flex flex-col gap-4 max-w-xl">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Project Display Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Project Identifier (Slug)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 font-mono outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Tenant UUID
            </label>
            <div className="flex items-center gap-2 p-2 rounded-md bg-[#0D0D12] border border-[#292532] text-xs font-mono text-zinc-400">
              <span className="truncate">{tenantId}</span>
              <CopyButton value={tenantId} />
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Immutable UUID assigned to this tenant isolation boundary.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Default Environment
            </label>
            <select
              value={defaultEnv}
              onChange={(e) => setDefaultEnv(e.target.value)}
              className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 font-mono outline-none focus:border-[#8B5CF6]"
            >
              <option value="production">production</option>
              <option value="staging">staging</option>
              <option value="development">development</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              System Timezone
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 font-mono outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-md bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-medium text-white shadow-[0_0_12px_rgba(139,92,246,0.25)] flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
            {saved && (
              <span className="text-xs font-mono text-emerald-400 animate-in fade-in">
                Settings saved successfully
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
