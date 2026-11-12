"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-[#292532] bg-[#14141B] p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-md shrink-0",
                isDestructive ? "bg-rose-950/50 text-rose-400 border border-rose-800/40" : "bg-purple-950/50 text-[#A78BFA] border border-[#8B5CF6]/30"
              )}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#F5F3FF]">{title}</h2>
              <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#292532]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white rounded-md bg-[#1B1923] border border-[#292532] hover:bg-[#252230] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(139,92,246,0.25)]"
            )}
          >
            {isLoading && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
