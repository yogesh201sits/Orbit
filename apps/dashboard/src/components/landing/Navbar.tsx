"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ArrowUpRight, Terminal, ChevronRight } from "lucide-react";

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

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Platform", href: "#workflow-demo" },
    { label: "Capabilities", href: "#capabilities" },
    { label: "How it Works", href: "#how-it-works" },
    { label: "Demo", href: "#interactive-demo" },
    { label: "Architecture", href: "#architecture" },
    { label: "Self-Hosting", href: "#self-hosting" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          isScrolled
            ? "bg-[#08070D]/90 backdrop-blur-md border-b border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            : "bg-transparent border-b border-white/5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Left: Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/orbit-logo.png"
              alt="Orbit Logo"
              className="h-8 sm:h-9 w-auto object-contain"
            />
            <span className="text-[10px] text-[#A78BFA] font-mono font-bold tracking-wider px-1.5 py-0.5 bg-[#141020] border border-[#8B5CF6]/40 hidden sm:inline-block">
              v0.1.0
            </span>
          </Link>

          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-[#0D0B15]/80 border border-white/10 px-4 py-1.5 rounded-full backdrop-blur-md">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-1.5 text-xs font-mono font-medium tracking-wide text-[#A6A1B5] hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="hidden sm:flex items-center gap-3 font-mono">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#A6A1B5] hover:text-white transition-colors"
            >
              <GithubIcon className="w-4 h-4 text-white" />
              <span className="hidden md:inline">GitHub</span>
            </a>

            <Link
              href="/sign-in"
              className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>

            <Link
              href="/app"
              className="flex items-center gap-1.5 px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-bold uppercase tracking-wider text-white border border-white/30 shadow-[0_0_16px_rgba(139,92,246,0.4)] active:translate-y-0.5 transition-all"
            >
              <span>Console</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 text-white hover:text-[#A78BFA] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden font-mono">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed top-16 right-0 bottom-0 w-72 bg-[#0D0B15] border-l border-white/10 p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-4">
              <span className="text-[10px] text-[#A78BFA] font-bold uppercase tracking-widest block pb-2 border-b border-white/10">
                // PLATFORM NAVIGATION
              </span>
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 text-xs font-bold uppercase text-zinc-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-[#8B5CF6]/40 transition-colors"
                  >
                    <span>{link.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  </a>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 space-y-3">
              <Link
                href="/app"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#8B5CF6] text-white text-xs font-bold uppercase tracking-wider border border-white shadow-[0_0_12px_rgba(139,92,246,0.4)]"
              >
                <span>Launch Console</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center py-2 bg-black border border-white/20 text-white text-xs font-bold uppercase tracking-wider hover:border-[#8B5CF6]"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
