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
        <h2 className="text-sm font-semibold text-[#F5F3FF]">Deployment Environments</h2>
        <p className="text-xs text-[#A1A1AA]">
          Isolated execution namespaces with dedicated workers, database schemas, and API keys.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {ENVIRONMENTS.map((env) => (
          <div
            key={env.slug}
            className="rounded-lg border border-[#292532] bg-[#14141B] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-md bg-[#1B1923] border border-[#8B5CF6]/30 text-[#A78BFA] shrink-0 mt-0.5">
                <Globe className="w-5 h-5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#F5F3FF]">{env.name}</h3>
                  <StatusBadge status={env.status} size="sm" />
                  {env.isDefault && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#1B1923] text-[#A78BFA] border border-[#8B5CF6]/30">
                      Default
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 mt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500">Slug:</span>
                    <span>{env.slug}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500">API Endpoint:</span>
                    <span className="text-zinc-300">{env.apiUrl}</span>
                    <CopyButton value={env.apiUrl} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center sm:flex-col sm:items-end gap-1 text-xs font-mono text-zinc-400 shrink-0 border-t sm:border-t-0 border-[#292532] pt-2 sm:pt-0">
              <span className="text-zinc-500">Linked Keys:</span>
              <span className="text-zinc-200">{env.linkedKeysCount} active keys</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
