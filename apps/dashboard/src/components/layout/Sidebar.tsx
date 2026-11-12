"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, Show, UserButton } from "@clerk/nextjs";
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
        "h-screen flex flex-col bg-[#050508] border-r-2 border-[#8B5CF6] transition-all duration-150 select-none",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b-2 border-[#2D273D] bg-black shrink-0">
        <Link href="/app" className="flex items-center gap-2.5 overflow-hidden group">
          {collapsed ? (
            <div className="w-9 h-9 border-2 border-[#8B5CF6] overflow-hidden flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#FFFFFF] bg-black">
              <img
                src="/orbit-logo.jpg"
                alt="Orbit"
                className="h-9 w-auto max-w-none object-cover object-left scale-150 -ml-1.5"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <img
                src="/orbit-logo.jpg"
                alt="Orbit Logo"
                className="h-8 w-auto object-contain"
              />
            </div>
          )}
        </Link>

        {!isMobileOpen && (
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="text-white hover:text-[#A78BFA] p-1 hover:bg-[#151120] border border-transparent hover:border-[#8B5CF6] hidden md:flex transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Project Indicator */}
      {!collapsed ? (
        <div className="px-3.5 py-2.5 border-b-2 border-[#2D273D] bg-[#0A0A0F]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="truncate">ACME CORP</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2 py-0.5 bg-black text-white border border-white shadow-[2px_2px_0px_#8B5CF6]">
              ONLINE
            </span>
          </div>
        </div>
      ) : (
        <div className="py-2.5 flex justify-center border-b-2 border-[#2D273D] bg-[#0A0A0F]">
          <span className="w-2 h-2 bg-[#8B5CF6] shadow-[0_0_6px_#8B5CF6]" title="Project: Acme Corp" />
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-1.5 overflow-y-auto scrollbar-none font-mono">
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
                "flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all",
                active
                  ? "bg-[#8B5CF6] text-white border-2 border-white shadow-[3px_3px_0px_#FFFFFF]"
                  : "text-zinc-400 hover:text-white hover:bg-[#14101F] hover:border-2 hover:border-[#8B5CF6]/60 border-2 border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  active ? "text-white" : "text-zinc-400"
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {active && !collapsed && (
                <span className="ml-auto text-[10px] font-black text-white">▶</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Settings Area */}
      <div className="p-2 border-t-2 border-[#2D273D] flex flex-col gap-1.5 shrink-0 bg-black font-mono">
        <Link
          href="/app/settings"
          onClick={onMobileClose}
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all",
            pathname.startsWith("/app/settings")
              ? "bg-[#8B5CF6] text-white border-2 border-white shadow-[3px_3px_0px_#FFFFFF]"
              : "text-zinc-400 hover:text-white hover:bg-[#14101F] hover:border-2 hover:border-[#8B5CF6]/60 border-2 border-transparent"
          )}
        >
          <Settings className="w-4 h-4 shrink-0 text-white" />
          {!collapsed && <span>Settings</span>}
        </Link>

        {/* Clerk User Controls */}
        <div
          title={collapsed ? "Operator" : undefined}
          className={cn(
            "p-2 bg-[#0A0A0F] border-2 border-[#2D273D] flex items-center gap-2",
            collapsed ? "justify-center px-1" : "px-2"
          )}
        >
          <Suspense fallback={<div className="w-7 h-7 bg-black border border-[#2D273D]" />}>
            <Show when="signed-in">
              <div className="flex items-center gap-2 overflow-hidden w-full">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "w-7 h-7 rounded-none border border-white",
                    },
                  }}
                />
                {!collapsed && (
                  <div className="flex flex-col truncate">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider truncate">
                      OPERATOR
                    </span>
                    <span className="text-[9px] text-[#A78BFA] uppercase tracking-widest truncate">
                      AUTHENTICATED
                    </span>
                  </div>
                )}
              </div>
            </Show>
            <Show when="signed-out">
              <div className="flex items-center gap-2 w-full justify-center">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="w-full px-2 py-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[10px] font-mono font-bold uppercase tracking-wider border border-white transition-all shadow-[2px_2px_0px_#000000]"
                  >
                    {collapsed ? "LOGIN" : "SIGN IN"}
                  </button>
                </SignInButton>
              </div>
            </Show>
          </Suspense>
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
            className="fixed inset-0 bg-black/90 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-2xl animate-in slide-in-from-left duration-150">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
