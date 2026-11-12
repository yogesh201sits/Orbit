import React from "react";
import { FolderOpen } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-[#8B5CF6]/50 rounded-none bg-[#050508]">
      <div className="p-3 bg-black border-2 border-[#8B5CF6] text-white shadow-[3px_3px_0px_#8B5CF6] mb-4">
        {icon || <FolderOpen className="w-6 h-6 text-[#A78BFA]" />}
      </div>
      <h3 className="text-sm font-black font-mono uppercase tracking-wider text-white">
        [ {title} ]
      </h3>
      <p className="text-xs text-zinc-400 font-mono max-w-sm mt-1 mb-4 leading-relaxed">
        // {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
