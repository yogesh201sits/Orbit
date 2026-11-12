import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pb-5 pt-1 border-b-2 border-[#8B5CF6] mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono uppercase tracking-wider mb-1">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} className="hover:text-white hover:underline transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-white font-bold" : ""}>[{crumb.label}]</span>
                )}
                {!isLast && <span className="text-[#8B5CF6] font-bold">/</span>}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <span className="w-2.5 h-5 bg-[#8B5CF6] inline-block" />
            {title}
          </h1>
          {description && (
            <p className="text-xs text-zinc-400 mt-1 font-mono tracking-wide">
              // {description}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
