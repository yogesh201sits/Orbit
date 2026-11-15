"use client";

import React from "react";

export interface OrbitSymbolProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export function OrbitSymbol({ className = "", size = 28, glow = true }: OrbitSymbolProps) {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 bg-[#8B5CF6]/30 blur-md rounded-full pointer-events-none scale-125"
          aria-hidden="true"
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        {/* Outer Orbit Path */}
        <circle
          cx="16"
          cy="16"
          r="14"
          stroke="rgba(167, 139, 250, 0.35)"
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />

        {/* Inner Orbit Ellipse */}
        <ellipse
          cx="16"
          cy="16"
          rx="11"
          ry="6"
          transform="rotate(-25 16 16)"
          stroke="#8B5CF6"
          strokeWidth="1.4"
        />

        {/* Central Execution Core */}
        <circle cx="16" cy="16" r="3.2" fill="#FFFFFF" />
        <circle cx="16" cy="16" r="1.6" fill="#8B5CF6" />

        {/* Connected Orbital Nodes */}
        <circle cx="6.5" cy="11.5" r="1.8" fill="#A78BFA" />
        <circle cx="25.5" cy="20.5" r="1.8" fill="#A78BFA" />
        <circle cx="21" cy="7.5" r="1.4" fill="#FFFFFF" />
        <circle cx="11" cy="24.5" r="1.4" fill="#FFFFFF" />

        {/* Connection Vector Lines */}
        <line
          x1="16"
          y1="16"
          x2="6.5"
          y2="11.5"
          stroke="rgba(139, 92, 246, 0.6)"
          strokeWidth="1"
        />
        <line
          x1="16"
          y1="16"
          x2="25.5"
          y2="20.5"
          stroke="rgba(139, 92, 246, 0.6)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
