"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Copy,
  Check,
  Terminal,
  Code2,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CopyButton } from "@/components/ui/CopyButton";
import { api } from "@/lib/api/client";
import type { ApiKeyItem } from "@/types/orbit";

export default function NewApiKeyPage() {
  const router = useRouter();

  // Form State
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"production" | "staging" | "development">("production");
  const [scope, setScope] = useState<"full_access" | "worker_executor" | "client_dispatch">("full_access");
  const [expiryDays, setExpiryDays] = useState<string>("30");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success State
  const [createdKey, setCreatedKey] = useState<ApiKeyItem | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<"worker" | "client" | "curl">("worker");

  // Handshake tester
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; workflowsCount?: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Please enter an API key name.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      let expiresAt: string | undefined = undefined;
      if (expiryDays !== "never") {
        const days = parseInt(expiryDays, 10);
        const d = new Date();
        d.setDate(d.getDate() + days);
        expiresAt = d.toISOString();
      }

      const res = await api.createApiKey(name.trim(), expiresAt);
      if (res.data) {
        setCreatedKey(res.data);
      } else {
        setErrorMessage("Failed to provision API key. Please try again.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to create API key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const testKeyHandshake = async (apiKey: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/auth/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `[SDK HANDSHAKE OK] Verified via ${data.sdkVersion} (${data.keyPrefix}...)`,
          workflowsCount: data.workflowsCount,
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || "Failed SDK handshake verification",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Control plane connection timeout",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getSdkWorkerSnippet = (key: string) => `import { Orbit } from "@durable/sdk";

// Initialize Orbit Worker instance with secret API key
const orbit = new Orbit({
  apiKey: "${key}",
  baseUrl: process.env.ORBIT_API_URL || "http://localhost:3001",
});

// Define durable workflow
export const orderWorkflow = orbit.workflow({
  id: "order-fulfillment",
  handler: async ({ step }) => {
    const payment = await step.run("charge-payment", async () => {
      return { status: "PAID", amount: 150 };
    });

    await step.sleep("settle-delay", "10s");
    return { orderId: "ord_102", payment };
  }
});

// Register definition with the Orbit Control Plane
await orbit.register(orderWorkflow);`;

  const getSdkClientSnippet = (key: string) => `import { Orbit } from "@durable/sdk";

const orbit = new Orbit({
  apiKey: "${key}",
  baseUrl: process.env.ORBIT_API_URL || "http://localhost:3001",
});

// Trigger a workflow run programmatically
const run = await orbit.runs.create("order-fulfillment", {
  input: { customerId: "cust_9921" }
});

console.log("Workflow Run ID:", run.id);`;

  const getCurlSnippet = (key: string) => `curl -X POST http://localhost:3001/v1/workflows/order-fulfillment/runs \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"input": {"customerId": "cust_9921"}}'`;

  return (
    <div className="space-y-6 font-mono max-w-4xl mx-auto pb-12">
      {/* Navigation Header */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-[#2D273D]">
        <Link
          href="/app/settings/api-keys"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#8B5CF6]" />
          <span>Back to API Keys</span>
        </Link>
        <span className="text-xs text-[#A78BFA] font-bold uppercase tracking-widest">
          // ACCESS MANAGEMENT
        </span>
      </div>

      <PageHeader
        title="Create API Key"
        description="Provision a cryptographic key for SDK execution, worker daemon polling, and programmatic API access."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Settings", href: "/app/settings" },
          { label: "API Keys", href: "/app/settings/api-keys" },
          { label: "New Key" },
        ]}
      />

      {/* Creation View vs Success View */}
      {!createdKey ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-red-950/40 border-2 border-red-500 text-red-200 text-xs flex items-center gap-2.5 shadow-[2px_2px_0px_#000000]">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Card */}
          <div className="border-2 border-[#2D273D] bg-[#0A0A0F] p-6 space-y-6 shadow-[4px_4px_0px_#000000]">
            {/* Key Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white mb-2">
                Key Identifier / Name <span className="text-[#8B5CF6]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. prod-worker-fleet, client-dispatch-service"
                required
                className="w-full bg-black border-2 border-[#2D273D] focus:border-[#8B5CF6] px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 outline-none transition-colors"
              />
              <p className="text-[11px] text-zinc-400 mt-1.5">
                A human-readable label to identify the service or daemon using this credential.
              </p>
            </div>

            {/* Environment Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white mb-2">
                Target Environment
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "production", label: "Production", desc: "Live workloads" },
                  { id: "staging", label: "Staging", desc: "Pre-release testing" },
                  { id: "development", label: "Development", desc: "Local sandboxes" },
                ].map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => setEnvironment(env.id as any)}
                    className={`p-3 text-left border-2 transition-all ${
                      environment === env.id
                        ? "bg-[#14101F] border-[#8B5CF6] shadow-[2px_2px_0px_#8B5CF6]"
                        : "bg-black border-[#2D273D] hover:border-zinc-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase">{env.label}</span>
                      {environment === env.id && <span className="text-[#8B5CF6] text-xs">●</span>}
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-1">{env.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scope / Permissions */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white mb-2">
                Key Scope & Permissions
              </label>
              <div className="space-y-2.5">
                {[
                  {
                    id: "full_access",
                    name: "Full Control (Recommended)",
                    badge: "Admin",
                    desc: "Authorize SDK workers, dispatch workflow runs, manage schedules, and register definitions.",
                  },
                  {
                    id: "worker_executor",
                    name: "Worker Fleet Executor",
                    badge: "Executor",
                    desc: "Restricted to polling job queues, executing steps, reporting heartbeats, and updating run states.",
                  },
                  {
                    id: "client_dispatch",
                    name: "Client Dispatch Only",
                    badge: "Dispatch",
                    desc: "Restricted to triggering workflow runs and querying run execution status without worker access.",
                  },
                ].map((s) => (
                  <label
                    key={s.id}
                    onClick={() => setScope(s.id as any)}
                    className={`flex items-start gap-3 p-3.5 border-2 cursor-pointer transition-all ${
                      scope === s.id
                        ? "bg-[#14101F] border-[#8B5CF6] shadow-[2px_2px_0px_#8B5CF6]"
                        : "bg-black border-[#2D273D] hover:border-zinc-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      checked={scope === s.id}
                      onChange={() => setScope(s.id as any)}
                      className="mt-0.5 accent-[#8B5CF6]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase">{s.name}</span>
                        <span className="px-1.5 py-0.2 text-[10px] bg-black border border-[#2D273D] text-[#A78BFA] font-bold">
                          {s.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">{s.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Expiration Policy */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white mb-2">
                Expiration Window
              </label>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="w-full bg-black border-2 border-[#2D273D] focus:border-[#8B5CF6] px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
              >
                <option value="7">7 Days (Short-lived)</option>
                <option value="30">30 Days (Standard rotation)</option>
                <option value="90">90 Days (Quarterly rotation)</option>
                <option value="365">1 Year</option>
                <option value="never">Never (Persistent Infrastructure Key)</option>
              </select>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                Expired keys are rejected automatically with 401 Unauthorized status.
              </p>
            </div>

            {/* Description (Optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white mb-2">
                Notes & Owner (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Owned by Platform Eng Team, used by k8s cluster node-01"
                className="w-full bg-black border-2 border-[#2D273D] focus:border-[#8B5CF6] px-3.5 py-2 text-xs text-white placeholder-zinc-600 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-4 border-2 border-[#8B5CF6] bg-[#0A0A0F] shadow-[3px_3px_0px_#8B5CF6] flex items-start gap-3">
            <Lock className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
            <div className="text-xs text-white leading-relaxed">
              <strong className="text-[#A78BFA] uppercase">ZERO-KNOWLEDGE STORAGE:</strong> Raw API keys are never stored in plaintext. Orbit only persists constant-time SHA-256 cryptographic hashes. Your key will be revealed <strong>exactly once</strong> upon creation.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/app/settings/api-keys"
              className="px-4 py-2 bg-black hover:bg-[#14101F] border-2 border-[#2D273D] text-xs font-bold uppercase text-zinc-400 hover:text-white transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-bold uppercase tracking-wider text-white border-2 border-white shadow-[3px_3px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Provisioning Key...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate API Key</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Secret Reveal & SDK Integration View */
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="p-5 border-2 border-emerald-500 bg-[#07130E] text-white shadow-[4px_4px_0px_#10B981] flex items-start gap-3.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
                API Key Successfully Provisioned
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Your new secret key <code className="text-emerald-300">{createdKey.name}</code> has been generated and hashed in the database.
              </p>
            </div>
          </div>

          {/* One-Time Secret Reveal Box */}
          <div className="border-2 border-[#8B5CF6] bg-[#0A0A0F] p-6 space-y-4 shadow-[4px_4px_0px_#8B5CF6]">
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#2D273D]">
              <span className="text-xs font-bold uppercase text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#8B5CF6]" />
                Secret API Key (Revealed Once Only)
              </span>
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                [ DO NOT LOSE THIS KEY ]
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black border-2 border-[#8B5CF6] px-4 py-3 text-xs font-bold tracking-wider text-[#A78BFA] overflow-x-auto select-all">
                {showSecret
                  ? createdKey.plainTextKey || `${createdKey.keyPrefix}********************`
                  : createdKey.plainTextKey
                  ? `${createdKey.plainTextKey.slice(0, 14)}${"•".repeat(24)}`
                  : `${createdKey.keyPrefix}••••••••••••••••••••`}
              </div>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                title={showSecret ? "Hide key" : "Show key"}
                className="p-3 bg-black hover:bg-[#14101F] border-2 border-[#2D273D] text-white hover:text-[#A78BFA] transition-colors"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {createdKey.plainTextKey && (
                <div className="shrink-0">
                  <CopyButton value={createdKey.plainTextKey} label="COPY KEY" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-zinc-400">
              <div>
                <span className="text-zinc-500 uppercase">PREFIX: </span>
                <span className="text-white font-bold">{createdKey.keyPrefix}</span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase">ENV: </span>
                <span className="text-white font-bold uppercase">{environment}</span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase">SCOPE: </span>
                <span className="text-white font-bold uppercase">{scope.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase">EXPIRES: </span>
                <span className="text-white font-bold">
                  {createdKey.expiresAt ? new Date(createdKey.expiresAt).toLocaleDateString() : "Never"}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive SDK Handshake Tester */}
          {createdKey.plainTextKey && (
            <div className="border-2 border-[#2D273D] bg-black p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                    Live SDK Handshake Verification
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Test direct authentication of this key with the Orbit Control Plane via <code className="text-[#A78BFA]">@durable/sdk</code>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => testKeyHandshake(createdKey.plainTextKey!)}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14101F] hover:bg-[#1F1930] border-2 border-[#8B5CF6] text-xs font-bold uppercase text-white shadow-[2px_2px_0px_#8B5CF6] transition-all"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-[#8B5CF6]" : ""}`} />
                  <span>{isTesting ? "Testing..." : "Test Handshake"}</span>
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3 border-2 text-xs font-bold ${
                    testResult.success
                      ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                      : "bg-red-950/40 border-red-500 text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.success && testResult.workflowsCount !== undefined && (
                    <div className="text-[11px] text-zinc-400 font-normal mt-1 pl-6">
                      Connected to tenant workspace. Active workflow definitions: {testResult.workflowsCount}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SDK Code Snippets */}
          {createdKey.plainTextKey && (
            <div className="border-2 border-[#2D273D] bg-[#0A0A0F] overflow-hidden shadow-[4px_4px_0px_#000000]">
              <div className="px-4 py-3 bg-black border-b-2 border-[#2D273D] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Quickstart SDK Integration
                </span>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setActiveSnippetTab("worker")}
                    className={`px-2.5 py-1 font-bold uppercase transition-all ${
                      activeSnippetTab === "worker"
                        ? "bg-[#8B5CF6] text-white border border-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Worker SDK
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSnippetTab("client")}
                    className={`px-2.5 py-1 font-bold uppercase transition-all ${
                      activeSnippetTab === "client"
                        ? "bg-[#8B5CF6] text-white border border-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Client SDK
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSnippetTab("curl")}
                    className={`px-2.5 py-1 font-bold uppercase transition-all ${
                      activeSnippetTab === "curl"
                        ? "bg-[#8B5CF6] text-white border border-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    cURL
                  </button>
                </div>
              </div>

              <div className="p-4 bg-black relative">
                <pre className="text-xs text-[#C4B5FD] font-mono overflow-x-auto p-3 bg-[#050508] border border-[#2D273D] leading-relaxed">
                  {activeSnippetTab === "worker" && getSdkWorkerSnippet(createdKey.plainTextKey)}
                  {activeSnippetTab === "client" && getSdkClientSnippet(createdKey.plainTextKey)}
                  {activeSnippetTab === "curl" && getCurlSnippet(createdKey.plainTextKey)}
                </pre>
                <div className="absolute top-6 right-6">
                  <CopyButton
                    value={
                      activeSnippetTab === "worker"
                        ? getSdkWorkerSnippet(createdKey.plainTextKey)
                        : activeSnippetTab === "client"
                        ? getSdkClientSnippet(createdKey.plainTextKey)
                        : getCurlSnippet(createdKey.plainTextKey)
                    }
                    label="COPY CODE"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-[#2D273D]">
            <button
              type="button"
              onClick={() => {
                setCreatedKey(null);
                setName("");
                setTestResult(null);
              }}
              className="px-4 py-2 bg-black hover:bg-[#14101F] border-2 border-[#2D273D] text-xs font-bold uppercase text-zinc-300 hover:text-white transition-all"
            >
              + Create Another Key
            </button>
            <Link
              href="/app/settings/api-keys"
              className="px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-bold uppercase tracking-wider text-white border-2 border-white shadow-[3px_3px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              Done & Return to Keys List →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
