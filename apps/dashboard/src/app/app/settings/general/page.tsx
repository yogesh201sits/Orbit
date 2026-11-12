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
      <div className="border-2 border-[#2D273D] bg-black p-5 shadow-[4px_4px_0px_#000000]">
        <div className="flex items-center gap-2 pb-3 border-b-2 border-[#2D273D]">
          <Building2 className="w-4 h-4 text-[#8B5CF6]" />
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Project Profile</h2>
        </div>

        <form onSubmit={handleSave} className="mt-4 flex flex-col gap-4 max-w-xl font-mono">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white font-bold mb-1">
              Project Display Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-[#0A0A0F] border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-white font-bold mb-1">
              Project Identifier (Slug)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-[#0A0A0F] border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-white font-bold mb-1">
              Tenant UUID
            </label>
            <div className="flex items-center justify-between gap-2 p-2.5 bg-[#0A0A0F] border-2 border-[#2D273D] text-xs font-mono text-white">
              <span className="truncate">{tenantId}</span>
              <CopyButton value={tenantId} />
            </div>
            <span className="text-[10px] text-[#A1A1AA] mt-1 block">
              Immutable UUID assigned to this tenant isolation boundary.
            </span>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-white font-bold mb-1">
              Default Environment
            </label>
            <select
              value={defaultEnv}
              onChange={(e) => setDefaultEnv(e.target.value)}
              className="w-full bg-[#0A0A0F] border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#8B5CF6]"
            >
              <option value="production" className="bg-black text-white">production</option>
              <option value="staging" className="bg-black text-white">staging</option>
              <option value="development" className="bg-black text-white">development</option>
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-white font-bold mb-1">
              System Timezone
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-[#0A0A0F] border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-mono font-bold uppercase tracking-wider text-white border-2 border-white shadow-[3px_3px_0px_#000000] flex items-center gap-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
            {saved && (
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider bg-[#8B5CF6] px-2 py-1 border border-white">
                [SETTINGS SAVED]
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
