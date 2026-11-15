"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Terminal, Sparkles, Shield, Cpu, Zap } from "lucide-react";
import { WorkflowGraphVisualizer } from "./WorkflowGraphVisualizer";
import { GradientASCII } from "@/components/ui/GradientASCII";
import MaskedHeading from "./MaskedHeading";

export function Hero() {
  return (
    <section className="relative pt-28 sm:pt-36 lg:pt-44 pb-20 overflow-hidden">
      {/* Dynamic React Bits GradientASCII interactive background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-auto">
        <GradientASCII
          colors={["#1e1b4b", "#4c1d95", "#8b5cf6", "#c4b5fd", "#38bdf8"]}
          shape="horizon"
          characters=" =+xX0S8#@"
          cellSize={16}
          density={0.75}
          glyphOpacity={0.8}
          gradientOpacity={0.65}
          glow={0.3}
          speed={0.7}
          mouseInteraction={true}
          clickEffect="wave"
        />
        {/* Seamless bottom fade mask to blend with dark page */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#08070D]/40 to-[#08070D] pointer-events-none" />
      </div>

      {/* Background radial glows and grid textures */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-radial-purple-glow opacity-60 pointer-events-none z-[1]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-grid-tech bg-dot-matrix-subtle opacity-25 pointer-events-none z-[1]"
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

          {/* Oversized Editorial Headline with MaskedHeading */}
          <div className="w-full max-w-5xl mx-auto my-2">
            <MaskedHeading
              text="Designed in the details"
              tag="h1"
              mediaType="video"
              src="/reel.mp4"
              poster="/reel-poster.jpg"
              fillScale={1.25}
              parallax={26}
              reveal="scale"
              trigger="view"
              spotlight={false}
              spotlightRadius={180}
              outline={false}
              duration={1.1}
              stagger={0.09}
              drift={18}
              hoverZoom={0}
              align="center"
              brightness={1}
              saturation={1}
              grayscale={false}
              outlineWidth={1}
              weight={700}
              tracking={-0.03}
              lineHeight={1.06}
              textScale={0.115}
            />
          </div>

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
