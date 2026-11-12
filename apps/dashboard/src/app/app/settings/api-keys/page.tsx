"use client";

import React, { useState, useEffect } from "react";
import {
  KeyRound,
  Plus,
  RotateCw,
  Trash2,
  AlertTriangle,
  Check,
  ShieldCheck,
  X,
  Lock,
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

  // Create Key modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // One-time secret display modal
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

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

    setIsSubmitting(true);
    try {
      const res = await api.createApiKey(keyName.trim());
      setIsCreateOpen(false);
      setKeyName("");

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#F5F3FF]">API Keys</h2>
          <p className="text-xs text-[#A1A1AA]">
            Secret credentials for authenticating SDK workers and external dispatch clients.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#8B5CF6] hover:bg-[#7C3AED] text-xs font-medium text-white transition-colors shadow-[0_0_12px_rgba(139,92,246,0.25)]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Key</span>
        </button>
      </div>

      {/* Security Disclaimer Banner */}
      <div className="p-3.5 rounded-lg bg-[#0D0D12] border border-[#292532] flex items-start gap-3 text-xs">
        <Lock className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
        <div className="text-zinc-400 leading-relaxed font-sans">
          <strong className="text-zinc-200">Security Requirement:</strong> For your security, the secret key is only displayed once upon generation. Orbit does not store raw secrets; all verification is evaluated via one-way cryptographic SHA-256 hashes.
        </div>
      </div>

      {/* API Keys Table */}
      <div className="rounded-lg border border-[#292532] bg-[#14141B] overflow-hidden">
        {keys.length === 0 ? (
          <EmptyState
            title="No API keys"
            description="Create an API key to connect your worker fleet or trigger workflows programmatically."
            icon={<KeyRound className="w-6 h-6" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0D0D12] border-b border-[#292532] text-zinc-400 font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Key Prefix</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Created</th>
                  <th className="py-3 px-4 font-medium">Expires</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292532]/60 font-mono">
                {keys.map((key) => {
                  const isRevoked = Boolean(key.revokedAt);
                  return (
                    <tr key={key.id} className="hover:bg-[#1B1923]/60 transition-colors">
                      <td className="py-3.5 px-4 font-sans font-medium text-[#F5F3FF]">
                        {key.name}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-[#0D0D12] border border-[#292532] text-[#A78BFA]">
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
                      <td className="py-3.5 px-4 text-zinc-400">
                        {formatDate(key.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400">
                        {key.expiresAt ? formatDate(key.expiresAt) : "Never"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isRevoked && (
                          <button
                            type="button"
                            onClick={() => setRevokeTargetId(key.id)}
                            title="Revoke API Key"
                            className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
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

      {/* Create Key Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-lg border border-[#292532] bg-[#14141B] p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#292532]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#8B5CF6]" />
                <h2 className="text-sm font-semibold text-[#F5F3FF]">Create API Key</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Key Description / Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Worker Fleet Key"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full bg-[#0D0D12] border border-[#292532] rounded-md px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#292532]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-300 rounded-md bg-[#1B1923] border border-[#292532]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(139,92,246,0.25)] flex items-center gap-1.5"
                >
                  {isSubmitting && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secret One-Time Display Modal */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-lg border border-[#8B5CF6]/50 bg-[#14141B] p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A78BFA]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#F5F3FF]">
                  API Key Created Successfully
                </h2>
                <p className="text-xs text-amber-300 font-medium mt-0.5">
                  Save this key now. It will never be displayed again.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-[#0D0D12] border border-[#292532] flex items-center justify-between gap-3 font-mono text-xs text-emerald-400 break-all select-all">
              <span>{newlyCreatedKey}</span>
              <CopyButton value={newlyCreatedKey} label="Copy" />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setNewlyCreatedKey(null)}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(139,92,246,0.25)]"
              >
                I have securely saved this key
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
