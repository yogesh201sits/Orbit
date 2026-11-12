import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
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
      className={`${geistSans.variable} ${geistMono.variable} dark h-full bg-[#000000] text-[#FFFFFF] antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#000000] text-[#FFFFFF] font-mono">
        <ClerkProvider
          appearance={{
            theme: dark,
            variables: {
              colorPrimary: "#8B5CF6",
              colorPrimaryForeground: "#FFFFFF",
              colorBackground: "#0A0A0F",
              colorForeground: "#FFFFFF",
              colorInput: "#000000",
              colorInputForeground: "#FFFFFF",
              colorNeutral: "#FFFFFF",
              borderRadius: "0px",
            },
            elements: {
              card: "border-2 border-[#8B5CF6] shadow-[6px_6px_0px_#8B5CF6] rounded-none bg-[#0A0A0F]",
              formButtonPrimary:
                "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-mono uppercase font-bold border-2 border-white shadow-[3px_3px_0px_#000000] rounded-none active:translate-x-0.5 active:translate-y-0.5",
              formFieldInput:
                "bg-black border-2 border-[#2D273D] text-white rounded-none focus:border-[#8B5CF6] font-mono",
              footerActionLink: "text-[#A78BFA] hover:text-white font-mono uppercase",
              userButtonPopoverCard:
                "border-2 border-[#8B5CF6] shadow-[4px_4px_0px_#8B5CF6] rounded-none bg-[#0A0A0F]",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
