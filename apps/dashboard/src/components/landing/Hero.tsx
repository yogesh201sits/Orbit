"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Terminal, Sparkles, Shield, Cpu, Zap } from "lucide-react";
import { WorkflowGraphVisualizer } from "./WorkflowGraphVisualizer";

export function Hero() {
  return (
    <section className="relative pt-28 sm:pt-36 lg:pt-44 pb-20 overflow-hidden">
      {/* Background radial glows and grid textures */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-radial-purple-glow opacity-80 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-grid-tech bg-dot-matrix-subtle opacity-35 pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {/* Announcement Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141020]/90 border border-[#8B5CF6]/50 shadow-[0_0_20px_rgba(139,92,246,0.25)] backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse" />
            <span className="text-[11px] sm:text-xs font-mono font-bold tracking-widest text-[#F8F7FC] uppercase">
              INTRODUCING ORBIT — DURABLE WORKFLOW INFRASTRUCTURE
            </span>
          </div>

          {/* Oversized Editorial Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[84px] font-black tracking-tight text-[#F8F7FC] leading-[1.05] uppercase font-sans">
            Workflows that <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#A78BFA] via-[#8B5CF6] to-[#C4B5FD] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(139,92,246,0.6)]">
              never lose their way.
            </span>
          </h1>

          {/* Supporting Copy */}
          <p className="text-base sm:text-lg md:text-xl text-[#A6A1B5] font-normal leading-relaxed max-w-2xl font-sans">
            Build reliable workflows that survive failures, resume exactly where they stopped, and keep your critical processes moving.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto font-mono pt-2">
            <Link
              href="/app"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-sm font-bold uppercase tracking-wider text-white border-2 border-white shadow-[4px_4px_0px_#000000] hover:shadow-[5px_5px_0px_#A78BFA] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <span>Start building</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0D0B15] hover:bg-[#141020] text-sm font-bold uppercase tracking-wider text-[#F8F7FC] border-2 border-white/15 hover:border-[#8B5CF6] transition-all"
            >
              <Terminal className="w-4 h-4 text-[#A78BFA]" />
              <span>Explore documentation</span>
            </a>
          </div>

          {/* Subtitle technical note */}
          <div className="flex items-center gap-3 text-xs font-mono text-[#706B80] pt-1">
            <span className="w-1.5 h-1.5 bg-[#8B5CF6] rounded-full inline-block" />
            <span>Built for developers. Designed for reliability.</span>
            <span className="w-1.5 h-1.5 bg-[#8B5CF6] rounded-full inline-block" />
          </div>
        </div>

        {/* Centerpiece Interactive Workflow Visualization */}
        <div id="workflow-demo" className="mt-14 sm:mt-20">
          <WorkflowGraphVisualizer />
        </div>
      </div>
    </section>
  );
}
