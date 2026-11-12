"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sliders, KeyRound, Globe, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

const SETTINGS_NAV = [
  { label: "General", href: "/app/settings/general", icon: Sliders },
  { label: "API Keys", href: "/app/settings/api-keys", icon: KeyRound },
  { label: "Environments", href: "/app/settings/environments", icon: Globe },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Project configuration, API keys, and deployment environments."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Settings" },
        ]}
      />

      <div className="flex flex-col md:flex-row gap-6">
        {/* Settings Sub-nav */}
        <aside className="w-full md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-2 border-b-2 md:border-b-0 md:border-r-2 border-[#2D273D] pb-3 md:pb-0 md:pr-4">
            {SETTINGS_NAV.map((item) => {
              const active =
                pathname === item.href ||
                (pathname === "/app/settings" && item.href === "/app/settings/general");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-mono uppercase tracking-wider transition-all border-2 ${
                    active
                      ? "bg-[#8B5CF6] text-white border-white font-bold shadow-[3px_3px_0px_#FFFFFF]"
                      : "bg-[#0A0A0F] text-[#A1A1AA] border-[#2D273D] hover:text-white hover:border-[#8B5CF6] hover:bg-[#14141B]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-white" : "text-[#8B5CF6]"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content area */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
