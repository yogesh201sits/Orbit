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
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-100">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-none border-2 border-[#8B5CF6] bg-[#0A0A0F] p-6 shadow-[6px_6px_0px_#8B5CF6] flex flex-col gap-4 animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#2D273D] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#8B5CF6] text-white">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black font-mono uppercase tracking-wider text-white">
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-zinc-400 hover:text-white p-1 hover:bg-[#1B1923] border border-transparent hover:border-[#8B5CF6]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-300 font-mono leading-relaxed">
          {description}
        </p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#2D273D]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white bg-black border-2 border-[#2D273D] hover:border-white hover:shadow-[2px_2px_0px_#FFFFFF] transition-all"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-mono font-black uppercase tracking-wider bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-white shadow-[3px_3px_0px_#FFFFFF] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1.5"
          >
            {isLoading && (
              <span className="w-3 h-3 border-2 border-white/40 border-t-white animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
