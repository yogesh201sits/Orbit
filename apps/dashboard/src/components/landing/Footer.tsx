"use client";

import React from "react";
import Link from "next/link";
import { Terminal, ArrowUpRight } from "lucide-react";

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050508] py-16 font-mono text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-white/10">
          {/* Brand Column */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <img
                src="/orbit-logo.png"
                alt="Orbit Logo"
                className="h-7 w-auto object-contain"
              />
            </Link>
            <p className="text-xs text-[#A6A1B5] font-sans max-w-sm leading-relaxed">
              Durable workflow orchestration platform for developers. Your workflows keep moving, even when things go wrong.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-[#0D0B15] border border-white/10 hover:border-[#8B5CF6] text-zinc-400 hover:text-white transition-colors"
                aria-label="Orbit on GitHub"
              >
                <GithubIcon className="w-4 h-4" />
              </a>
              <Link
                href="/app"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141020] border border-[#8B5CF6]/50 text-white font-bold text-[11px] uppercase hover:bg-[#8B5CF6] transition-colors"
              >
                <span>Console</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
              Product
            </span>
            <ul className="space-y-2 text-[#A6A1B5]">
              <li>
                <a href="#workflow-demo" className="hover:text-white transition-colors">Platform</a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-white transition-colors">Features</a>
              </li>
              <li>
                <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
              </li>
              <li>
                <Link href="/app" className="hover:text-white transition-colors">Control Plane</Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Developers */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
              Developers
            </span>
            <ul className="space-y-2 text-[#A6A1B5]">
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">Documentation</a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">@durable/sdk</a>
              </li>
              <li>
                <Link href="/app/settings/api-keys" className="hover:text-white transition-colors">API Reference</Link>
              </li>
              <li>
                <a href="#self-hosting" className="hover:text-white transition-colors">Self-Hosting Guide</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block">
              Resources
            </span>
            <ul className="space-y-2 text-[#A6A1B5]">
              <li>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  GitHub Repository
                </a>
              </li>
              <li>
                <span className="text-[#706B80]">Changelog (v0.1.0)</span>
              </li>
              <li>
                <a href="#interactive-demo" className="hover:text-white transition-colors">Interactive Demo</a>
              </li>
              <li>
                <Link href="/sign-in" className="hover:text-white transition-colors">Operator Login</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#706B80]">
          <div>
            &copy; {new Date().getFullYear()} Orbit Control Plane Infrastructure. Open source under MIT.
          </div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Engine Online
            </span>
            <span>PostgreSQL Native</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
