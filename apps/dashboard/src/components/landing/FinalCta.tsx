"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Terminal, Sparkles } from "lucide-react";

export function FinalCta() {
  return (
    <section className="py-28 sm:py-36 relative bg-[#08070D]/40 backdrop-blur-[1px] font-mono overflow-hidden border-t border-white/10">
      {/* Background Animated Orbital Ring */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-radial-purple-glow opacity-60 pointer-events-none"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-[500px] h-[500px] border border-[#8B5CF6] rounded-full animate-spin [animation-duration:45s]" />
        <div className="w-[700px] h-[700px] border border-dashed border-white/20 rounded-full absolute" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
        <div className="flex justify-center">
          <img
            src="/orbit-logo.png"
            alt="Orbit Logo"
            className="h-10 sm:h-12 w-auto object-contain"
          />
        </div>

        <div className="space-y-4 max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#A78BFA] block">
            // NEXT GENERATION ORCHESTRATION
          </span>
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-[#F8F7FC] font-sans">
            Build workflows that <br />
            <span className="bg-gradient-to-r from-[#A78BFA] via-[#8B5CF6] to-[#C4B5FD] bg-clip-text text-transparent">
              keep their promises.
            </span>
          </h2>
          <p className="text-base sm:text-xl text-[#A6A1B5] font-sans max-w-xl mx-auto">
            Start building reliable execution into your applications with Orbit.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/app"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-[#8B5CF6] hover:bg-[#7C3AED] text-sm font-bold uppercase tracking-wider text-white border-2 border-white shadow-[4px_4px_0px_#000000] hover:shadow-[5px_5px_0px_#A78BFA] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <span>Get started</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <a
            href="#how-it-works"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 bg-[#0D0B15] hover:bg-[#141020] text-sm font-bold uppercase tracking-wider text-white border-2 border-white/15 hover:border-[#8B5CF6] transition-all"
          >
            <Terminal className="w-4 h-4 text-[#A78BFA]" />
            <span>Read the documentation</span>
          </a>
        </div>

        <p className="text-xs text-[#706B80] pt-4">
          Self-hostable open-source developer infrastructure.
        </p>
      </div>
    </section>
  );
}
