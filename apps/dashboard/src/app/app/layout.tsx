import React, { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

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
