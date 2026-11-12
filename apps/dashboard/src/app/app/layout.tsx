import React, { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-[#09090D] text-zinc-500 font-mono text-xs">
          Loading Orbit Control Plane...
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
