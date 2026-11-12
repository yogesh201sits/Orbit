"use client";

import React, { useState, useEffect } from "react";
import {
  KeyRound,
  Plus,
  RotateCw,
  Trash2,
  Check,
  ShieldCheck,
  X,
  Lock,
  Code2,
  Terminal,
  Cpu,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api/client";
import { formatDate, formatRelativeTime } from "@/lib/formatting";
import type { ApiKeyItem } from "@/types/orbit";

export default function ApiKeysSettingsPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Key modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [environment, setEnvironment] = useState<"production" | "staging" | "development">("production");
  const [expiryDays, setExpiryDays] = useState<string>("never");
  const [keyScope, setKeyScope] = useState<"full_access" | "worker_executor" | "client_dispatch">("full_access");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // One-time secret display modal
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<"worker" | "client" | "curl">("worker");

  // Handshake tester state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Revoke modal
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadKeys = async () => {
    setIsLoading(true);
    try {
      const res = await api.listApiKeys();
      setKeys(res.data);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    let expiresAt: string | undefined = undefined;
    if (expiryDays !== "never") {
      const days = parseInt(expiryDays, 10);
      const d = new Date();
      d.setDate(d.getDate() + days);
      expiresAt = d.toISOString();
    }

    setIsSubmitting(true);
    try {
      const res = await api.createApiKey(keyName.trim(), expiresAt);
      setIsCreateOpen(false);
      setKeyName("");
      setTestResult(null);

      // Reveal full plainTextKey once only
      if (res.data.plainTextKey) {
        setNewlyCreatedKey(res.data.plainTextKey);
      }
      await loadKeys();
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTargetId) return;
    setIsRevoking(true);
    try {
      await api.revokeApiKey(revokeTargetId);
      setRevokeTargetId(null);
      await loadKeys();
    } catch {
      // Handled
    } finally {
      setIsRevoking(false);
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
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || "Failed SDK handshake",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Connection timeout",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getSdkWorkerSnippet = (key: string) => `import { Orbit } from "@durable/sdk";

// Initialize Orbit instance with secret API key
const orbit = new Orbit({
  apiKey: "${key}",
  baseUrl: process.env.ORBIT_API_URL || "http://localhost:3001"
});

// Define a durable workflow
const orderWorkflow = orbit.workflow({
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
  baseUrl: process.env.ORBIT_API_URL || "http://localhost:3001"
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">API Keys & SDK Access</h2>
          <p className="text-xs font-mono text-[#A1A1AA]">
            Secret cryptographic credentials for authenticating SDK workers, CLI dispatch, and external clients.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-mono font-bold uppercase tracking-wider text-white border-2 border-white shadow-[3px_3px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New API Key</span>
        </button>
      </div>

      {/* Security Disclaimer Banner */}
      <div className="p-3.5 border-2 border-[#2D273D] bg-[#0A0A0F] shadow-[3px_3px_0px_#000000] flex items-start gap-3 text-xs font-mono">
        <Lock className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
        <div className="text-white leading-relaxed">
          <strong className="text-[#C4B5FD] uppercase">SECURITY NOTICE:</strong> Secret API keys are shown once upon creation and stored exclusively as SHA-256 hashes. Connect your backend services using the <code className="text-[#A78BFA]">@durable/sdk</code> package.
        </div>
      </div>

      {/* API Keys Table */}
      <div className="border-2 border-[#2D273D] bg-black shadow-[4px_4px_0px_#000000] overflow-hidden">
        {keys.length === 0 ? (
          <EmptyState
            title="No API keys configured"
            description="Generate an API key to connect your worker fleets and trigger workflow executions programmatically."
            icon={<KeyRound className="w-6 h-6" />}
            action={
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-3.5 py-1.5 bg-[#8B5CF6] text-xs font-mono font-bold uppercase tracking-wider text-white border-2 border-white shadow-[2px_2px_0px_#000000]"
              >
                Create First Key
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0A0A0F] border-b-2 border-[#2D273D] text-[#A1A1AA] uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-bold text-white">Name</th>
                  <th className="py-3 px-4 font-bold text-white">Key Prefix</th>
                  <th className="py-3 px-4 font-bold text-white">Status</th>
                  <th className="py-3 px-4 font-bold text-white">Created</th>
                  <th className="py-3 px-4 font-bold text-white">Expires</th>
                  <th className="py-3 px-4 font-bold text-white text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D273D]">
                {keys.map((key) => {
                  const isRevoked = Boolean(key.revokedAt);
                  return (
                    <tr key={key.id} className="hover:bg-[#0A0A0F] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{key.name}</span>
                          <span className="px-1.5 py-0.2 bg-[#050508] border border-[#2D273D] text-[10px] text-[#A1A1AA]">
                            SDK
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-[#050508] border border-[#8B5CF6] text-[#C4B5FD] font-mono">
                            {key.keyPrefix}...
                          </span>
                          <CopyButton value={key.keyPrefix} />
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          status={isRevoked ? "revoked" : "active"}
                          size="sm"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-[#A1A1AA]">
                        {formatDate(key.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-[#A1A1AA]">
                        {key.expiresAt ? formatDate(key.expiresAt) : "Never"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isRevoked && (
                          <button
                            type="button"
                            onClick={() => setRevokeTargetId(key.id)}
                            title="Revoke API Key"
                            className="p-1.5 border border-[#2D273D] bg-[#0A0A0F] text-white hover:bg-[#8B5CF6] hover:border-white transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SDK Documentation & Architecture Quickstart */}
      <div className="border-2 border-[#2D273D] bg-black p-5 shadow-[4px_4px_0px_#000000]">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#2D273D]">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#8B5CF6]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              SDK Integration Architecture (@durable/sdk)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#A78BFA] border border-[#8B5CF6] px-1.5 py-0.5 bg-[#0A0A0F]">
            VERSION 0.1.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 font-mono text-xs">
          <div className="p-3.5 border-2 border-[#2D273D] bg-[#0A0A0F]">
            <h4 className="font-bold text-white uppercase text-[11px] mb-1">1. Worker Fleet</h4>
            <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
              Worker processes poll queue leases via Redis/PostgreSQL and claim execution locks for deterministic steps.
            </p>
          </div>
          <div className="p-3.5 border-2 border-[#2D273D] bg-[#0A0A0F]">
            <h4 className="font-bold text-white uppercase text-[11px] mb-1">2. Client Dispatch</h4>
            <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
              API clients trigger workflow runs, cancel executions, inspect step graphs, and await completion idempotently.
            </p>
          </div>
          <div className="p-3.5 border-2 border-[#2D273D] bg-[#0A0A0F]">
            <h4 className="font-bold text-white uppercase text-[11px] mb-1">3. Clerk Authentication</h4>
            <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
              Dual-mode auth accepts raw SHA-256 Orbit keys or Clerk JWT session tokens with organization isolation.
            </p>
          </div>
        </div>
      </div>

      {/* Create Key Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="w-full max-w-lg border-2 border-[#8B5CF6] bg-[#0A0A0F] p-5 shadow-[6px_6px_0px_#8B5CF6] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#2D273D]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#8B5CF6]" />
                <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Create New API Key</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-[#A1A1AA] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-3.5 font-mono">
              <div>
                <label className="block text-xs uppercase tracking-wider text-white font-bold mb-1">
                  Key Description / Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Worker Fleet Key"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full bg-black border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white font-bold mb-1">
                    Environment
                  </label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as any)}
                    className="w-full bg-black border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white outline-none focus:border-[#8B5CF6]"
                  >
                    <option value="production">PRODUCTION</option>
                    <option value="staging">STAGING</option>
                    <option value="development">DEVELOPMENT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-white font-bold mb-1">
                    Expiration
                  </label>
                  <select
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    className="w-full bg-black border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white outline-none focus:border-[#8B5CF6]"
                  >
                    <option value="never">NO EXPIRATION</option>
                    <option value="30">30 DAYS</option>
                    <option value="90">90 DAYS</option>
                    <option value="365">1 YEAR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-white font-bold mb-1">
                  Access Scope
                </label>
                <select
                  value={keyScope}
                  onChange={(e) => setKeyScope(e.target.value as any)}
                  className="w-full bg-black border-2 border-[#2D273D] px-3 py-1.5 text-xs text-white outline-none focus:border-[#8B5CF6]"
                >
                  <option value="full_access">FULL ACCESS (WORKER + RUNS + ADMIN)</option>
                  <option value="worker_executor">WORKER EXECUTOR (LEASE & CLAIM ONLY)</option>
                  <option value="client_dispatch">CLIENT DISPATCH (TRIGGER RUNS ONLY)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-[#2D273D]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-bold text-white bg-black border-2 border-[#2D273D] hover:bg-[#14141B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-mono uppercase tracking-wider font-bold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-white shadow-[2px_2px_0px_#000000] flex items-center gap-1.5"
                >
                  {isSubmitting && <span className="w-3 h-3 border-2 border-white/40 border-t-white animate-spin" />}
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secret One-Time Display Modal with SDK Integration */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="w-full max-w-2xl border-2 border-white bg-black p-6 shadow-[8px_8px_0px_#8B5CF6] flex flex-col gap-4 font-mono max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#2D273D]">
              <div className="flex items-center gap-3">
                <div className="p-2 border-2 border-[#8B5CF6] bg-[#0A0A0F] text-[#C4B5FD]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold uppercase tracking-wider text-white">
                    API Key Generated Successfully
                  </h2>
                  <p className="text-xs text-[#C4B5FD] uppercase font-bold mt-0.5">
                    Save this key now. It cannot be recovered after this dialog closes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewlyCreatedKey(null)}
                className="text-[#A1A1AA] hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Secret key string */}
            <div className="p-3 border-2 border-[#8B5CF6] bg-[#0A0A0F] flex items-center justify-between gap-3 font-mono text-xs text-white font-bold break-all select-all">
              <span className="text-[#C4B5FD]">{newlyCreatedKey}</span>
              <CopyButton value={newlyCreatedKey} label="Copy Key" />
            </div>

            {/* SDK Handshake Live Test Button */}
            <div className="flex items-center justify-between p-2.5 border-2 border-[#2D273D] bg-[#050508]">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-xs font-bold text-white uppercase">Test SDK Auth Handshake</span>
              </div>
              <button
                type="button"
                onClick={() => testKeyHandshake(newlyCreatedKey)}
                disabled={isTesting}
                className="px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider bg-black hover:bg-[#8B5CF6] text-white border border-white transition-all"
              >
                {isTesting ? "Handshaking..." : "Run SDK Test"}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-2.5 border-2 text-xs font-mono font-bold uppercase ${
                  testResult.success
                    ? "border-white bg-[#0A0A0F] text-white"
                    : "border-[#8B5CF6] bg-black text-[#C4B5FD]"
                }`}
              >
                {testResult.message}
              </div>
            )}

            {/* Snippet Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-white">Quickstart Snippets</span>
                <div className="flex border-2 border-[#2D273D]">
                  <button
                    type="button"
                    onClick={() => setActiveSnippetTab("worker")}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all ${
                      activeSnippetTab === "worker"
                        ? "bg-[#8B5CF6] text-white"
                        : "bg-black text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    SDK Worker
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSnippetTab("client")}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase border-l-2 border-[#2D273D] transition-all ${
                      activeSnippetTab === "client"
                        ? "bg-[#8B5CF6] text-white"
                        : "bg-black text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    SDK Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSnippetTab("curl")}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase border-l-2 border-[#2D273D] transition-all ${
                      activeSnippetTab === "curl"
                        ? "bg-[#8B5CF6] text-white"
                        : "bg-black text-[#A1A1AA] hover:text-white"
                    }`}
                  >
                    cURL HTTP
                  </button>
                </div>
              </div>

              <div className="relative border-2 border-[#2D273D] bg-[#050508] p-3 text-xs overflow-x-auto">
                <div className="absolute top-2 right-2">
                  <CopyButton
                    value={
                      activeSnippetTab === "worker"
                        ? getSdkWorkerSnippet(newlyCreatedKey)
                        : activeSnippetTab === "client"
                        ? getSdkClientSnippet(newlyCreatedKey)
                        : getCurlSnippet(newlyCreatedKey)
                    }
                    label="Copy Code"
                  />
                </div>
                <pre className="text-white font-mono leading-relaxed pr-24">
                  {activeSnippetTab === "worker" && getSdkWorkerSnippet(newlyCreatedKey)}
                  {activeSnippetTab === "client" && getSdkClientSnippet(newlyCreatedKey)}
                  {activeSnippetTab === "curl" && getCurlSnippet(newlyCreatedKey)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t-2 border-[#2D273D]">
              <button
                type="button"
                onClick={() => setNewlyCreatedKey(null)}
                className="px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-white shadow-[3px_3px_0px_#FFFFFF] active:translate-x-0.5 active:translate-y-0.5"
              >
                I Have Saved This Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revocation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(revokeTargetId)}
        title="Revoke API Key"
        description="Are you sure you want to revoke this API key? Applications and workers using this key will immediately lose access and be rejected."
        confirmLabel="Revoke Key"
        isDestructive={true}
        isLoading={isRevoking}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTargetId(null)}
      />
    </div>
  );
}
