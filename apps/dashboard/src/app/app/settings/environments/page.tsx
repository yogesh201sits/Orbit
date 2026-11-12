"use client";

import React from "react";
import { Globe, ShieldCheck, Server, Radio } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";

interface EnvironmentConfig {
  name: string;
  slug: string;
  status: "active" | "inactive";
  isDefault: boolean;
  apiUrl: string;
  linkedKeysCount: number;
}

const ENVIRONMENTS: EnvironmentConfig[] = [
  {
    name: "Production",
    slug: "production",
    status: "active",
    isDefault: true,
    apiUrl: "https://api.orbit.internal/v1",
    linkedKeysCount: 2,
  },
  {
    name: "Staging",
    slug: "staging",
    status: "active",
    isDefault: false,
    apiUrl: "https://staging-api.orbit.internal/v1",
    linkedKeysCount: 1,
  },
  {
    name: "Development",
    slug: "development",
    status: "active",
    isDefault: false,
    apiUrl: "http://localhost:3001/v1",
    linkedKeysCount: 1,
  },
];

export default function EnvironmentsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Deployment Environments</h2>
        <p className="text-xs font-mono text-[#A1A1AA]">
          Isolated execution namespaces with dedicated workers, database schemas, and API keys.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {ENVIRONMENTS.map((env) => (
          <div
            key={env.slug}
            className="border-2 border-[#2D273D] bg-black p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[4px_4px_0px_#000000]"
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2 border-2 border-[#8B5CF6] bg-[#0A0A0F] text-[#C4B5FD] shrink-0 mt-0.5">
                <Globe className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">{env.name}</h3>
                  <StatusBadge status={env.status} size="sm" />
                  {env.isDefault && (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-[#8B5CF6] text-white border border-white">
                      Default
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-white mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#A1A1AA]">Slug:</span>
                    <span className="font-bold text-[#C4B5FD]">{env.slug}</span>
                  </div>
                  <span className="text-[#2D273D]">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#A1A1AA]">API Endpoint:</span>
                    <span className="text-white font-mono">{env.apiUrl}</span>
                    <CopyButton value={env.apiUrl} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center sm:flex-col sm:items-end gap-1 text-xs font-mono text-white shrink-0 border-t-2 sm:border-t-0 border-[#2D273D] pt-2 sm:pt-0">
              <span className="text-[#A1A1AA]">Linked Keys:</span>
              <span className="font-bold text-[#C4B5FD]">{env.linkedKeysCount} active keys</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
