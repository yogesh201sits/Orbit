"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitFork,
  PlayCircle,
  CalendarClock,
  Server,
  Activity,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  CircleDot,
  Radio,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/app", icon: LayoutDashboard, exact: true },
  { label: "Workflows", href: "/app/workflows", icon: GitFork },
  { label: "Runs", href: "/app/runs", icon: PlayCircle },
  { label: "Schedules", href: "/app/schedules", icon: CalendarClock },
  { label: "Workers", href: "/app/workers", icon: Server },
  { label: "Events", href: "/app/events", icon: Activity },
];

export interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("orbit_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // LocalStorage unavailable
    }
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("orbit_sidebar_collapsed", String(next));
    } catch {
      // Ignore
    }
  };

  const isActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const sidebarContent = (
    <aside
      className={cn(
        "h-screen flex flex-col bg-[#0D0D12] border-r border-[#292532] transition-all duration-200 select-none",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-[#292532] shrink-0">
        <Link href="/app" className="flex items-center gap-2.5 overflow-hidden group">
          <div className="w-8 h-8 rounded-lg bg-[#1B1923] border border-[#8B5CF6]/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(139,92,246,0.2)] group-hover:border-[#8B5CF6] transition-colors">
            <Radio className="w-4 h-4 text-[#A78BFA]" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-mono text-sm font-bold tracking-wider text-[#F5F3FF]">ORBIT</span>
              <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest font-mono">Control Plane</span>
            </div>
          )}
        </Link>

        {!isMobileOpen && (
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-md hover:bg-[#1B1923] transition-colors hidden md:flex"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Project / Environment Indicator */}
      {!collapsed ? (
        <div className="px-3.5 py-3 border-b border-[#292532]/70 bg-[#09090D]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
              <Layers className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="truncate font-medium">Acme Corp</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
              <CircleDot className="w-2.5 h-2.5" />
              Live
            </span>
          </div>
        </div>
      ) : (
        <div className="py-2.5 flex justify-center border-b border-[#292532]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#22c55e]" title="Project: Acme Corp (Live)" />
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-1 overflow-y-auto scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors relative group",
                active
                  ? "bg-[#1B1923] text-[#F5F3FF] border border-[#8B5CF6]/40 shadow-[0_0_10px_rgba(139,92,246,0.15)]"
                  : "text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#14141B]"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  active ? "text-[#A78BFA]" : "text-zinc-500 group-hover:text-zinc-300"
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {active && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Area */}
      <div className="p-2 border-t border-[#292532] flex flex-col gap-1 shrink-0">
        <Link
          href="/app/settings"
          onClick={onMobileClose}
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors group",
            pathname.startsWith("/app/settings")
              ? "bg-[#1B1923] text-[#F5F3FF] border border-[#8B5CF6]/40 shadow-[0_0_10px_rgba(139,92,246,0.15)]"
              : "text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#14141B]"
          )}
        >
          <Settings
            className={cn(
              "w-4 h-4 shrink-0 transition-colors",
              pathname.startsWith("/app/settings")
                ? "text-[#A78BFA]"
                : "text-zinc-500 group-hover:text-zinc-300"
            )}
          />
          {!collapsed && <span>Settings</span>}
        </Link>

        {/* Future Clerk User Integration Placeholder */}
        <div
          title={collapsed ? "Connected: dev-user-01" : undefined}
          className={cn(
            "mt-1 p-2 rounded-md bg-[#14141B] border border-[#292532] flex items-center gap-2.5",
            collapsed ? "justify-center px-1" : "px-2.5"
          )}
        >
          <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[10px] font-mono font-semibold text-[#A78BFA] shrink-0">
            DV
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="text-[11px] font-medium text-zinc-200 truncate">dev-operator</span>
              <span className="text-[9px] font-mono text-zinc-500 truncate">clerk-ready</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block shrink-0">{sidebarContent}</div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
