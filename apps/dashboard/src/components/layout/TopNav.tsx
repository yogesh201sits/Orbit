"use client";

import React, { useState } from "react";
import {
  Menu,
  Search,
  Terminal,
  Activity,
  Globe,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface TopNavProps {
  onMobileMenuToggle: () => void;
}

export function TopNav({ onMobileMenuToggle }: TopNavProps) {
  const pathname = usePathname();
  const [env, setEnv] = useState<"production" | "staging" | "development">("production");

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1),
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <header className="h-14 border-b border-[#292532] bg-[#0D0D12] px-4 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="md:hidden text-zinc-400 hover:text-white p-1 rounded-md"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb preview */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-400">
          <Link href="/app" className="hover:text-white transition-colors">
            Orbit
          </Link>
          {breadcrumbs.slice(1).map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              <span className="text-zinc-600">/</span>
              <Link href={crumb.href} className="hover:text-white transition-colors capitalize">
                {crumb.label}
              </Link>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Environment Selector */}
        <div className="flex items-center bg-[#14141B] border border-[#292532] rounded-md px-2 py-1 text-xs font-mono">
          <Globe className="w-3.5 h-3.5 text-zinc-400 mr-1.5" />
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as any)}
            className="bg-transparent text-zinc-200 outline-none text-xs cursor-pointer font-mono"
          >
            <option value="production" className="bg-[#14141B] text-zinc-200">
              production
            </option>
            <option value="staging" className="bg-[#14141B] text-zinc-200">
              staging
            </option>
            <option value="development" className="bg-[#14141B] text-zinc-200">
              development
            </option>
          </select>
        </div>

        {/* System Engine Health Pill */}
        <div className="hidden md:flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-md bg-[#14141B] border border-[#292532] text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#22c55e]" />
          <span>Engine: Operational</span>
        </div>

        {/* Command shortcut / search entry */}
        <button
          type="button"
          onClick={() => {
            // Quick search prompt focus
            const searchInput = document.querySelector<HTMLInputElement>("input[type='search'], input[placeholder*='Search']");
            if (searchInput) {
              searchInput.focus();
            }
          }}
          className="flex items-center gap-2 px-2.5 py-1 text-xs font-mono text-zinc-400 bg-[#14141B] hover:bg-[#1B1923] border border-[#292532] rounded-md transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline px-1 py-0.5 text-[10px] bg-[#09090D] border border-[#292532] rounded text-zinc-500">
            /
          </kbd>
        </button>
      </div>
    </header>
  );
}
