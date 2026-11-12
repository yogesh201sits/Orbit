import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orbit — Durable Workflow Orchestration Control Plane",
  description: "Production-quality developer infrastructure control plane for durable workflow orchestration.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full bg-[#09090D] text-[#F5F3FF] antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#09090D] text-[#F5F3FF] font-sans">
        {children}
      </body>
    </html>
  );
}
