"use client";

import React, { useState, Suspense } from "react";
import {
  Menu,
  Search,
  Globe,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, UserButton } from "@clerk/nextjs";

export interface TopNavProps {
  onMobileMenuToggle: () => void;
}

export function TopNav({ onMobileMenuToggle }: TopNavProps) {
  const pathname = usePathname();
  const [env, setEnv] = useState<"production" | "staging" | "development">("production");

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.toUpperCase(),
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <header className="h-14 border-b-2 border-[#2D273D] bg-black px-4 flex items-center justify-between shrink-0 select-none font-mono">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="md:hidden text-white hover:text-[#A78BFA] p-1 border border-[#2D273D] hover:border-[#8B5CF6]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/app" className="md:hidden flex items-center">
          <img src="/orbit-logo.jpg" alt="Orbit Logo" className="h-6 w-auto object-contain" />
        </Link>

        {/* Breadcrumb preview */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
          <Link href="/app" className="hover:text-white transition-colors">
            ORBIT
          </Link>
          {breadcrumbs.slice(1).map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              <span className="text-[#8B5CF6] font-bold">/</span>
              <Link href={crumb.href} className="hover:text-white transition-colors">
                {crumb.label}
              </Link>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Environment Selector */}
        <div className="flex items-center bg-[#0A0A0F] border-2 border-[#2D273D] px-2.5 py-1 text-xs">
          <Globe className="w-3.5 h-3.5 text-[#8B5CF6] mr-1.5" />
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as any)}
            className="bg-transparent text-white font-bold uppercase tracking-wider outline-none text-xs cursor-pointer font-mono"
          >
            <option value="production" className="bg-black text-white">
              ENV: PRODUCTION
            </option>
            <option value="staging" className="bg-black text-white">
              ENV: STAGING
            </option>
            <option value="development" className="bg-black text-white">
              ENV: DEVELOPMENT
            </option>
          </select>
        </div>

        {/* System Health Pill */}
        <div className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-[#0A0A0F] border-2 border-white shadow-[2px_2px_0px_#8B5CF6] text-white">
          <span className="w-2 h-2 bg-white" />
          <span>ENGINE: OK</span>
        </div>

        {/* Command shortcut / search entry */}
        <button
          type="button"
          onClick={() => {
            const searchInput = document.querySelector<HTMLInputElement>("input[type='search'], input[placeholder*='Search']");
            if (searchInput) {
              searchInput.focus();
            }
          }}
          className="flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white bg-black hover:bg-[#14101F] border-2 border-[#2D273D] hover:border-[#8B5CF6] transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span className="hidden sm:inline">FIND...</span>
          <kbd className="hidden sm:inline px-1 py-0.5 text-[10px] bg-[#14101F] border border-[#2D273D] text-[#A78BFA]">
            /
          </kbd>
        </button>

        <Suspense fallback={null}>
          <Show when="signed-in">
            <div className="flex items-center pl-1 border-l-2 border-[#2D273D]">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "w-7 h-7 rounded-none border border-white",
                  },
                }}
              />
            </div>
          </Show>
        </Suspense>
      </div>
    </header>
  );
}
