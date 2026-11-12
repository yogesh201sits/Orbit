import React from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { TechStrip } from "@/components/landing/TechStrip";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { FeaturesBento } from "@/components/landing/FeaturesBento";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { InteractiveDemo } from "@/components/landing/InteractiveDemo";
import { DeveloperExperience } from "@/components/landing/DeveloperExperience";
import { ArchitectureDiagram } from "@/components/landing/ArchitectureDiagram";
import { SelfHosting } from "@/components/landing/SelfHosting";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Orbit — Durable Workflow Infrastructure for Developers",
  description:
    "Build reliable workflows that survive failures, resume exactly where they stopped, and keep your critical processes moving. Function-first durable execution on PostgreSQL.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08070D] text-[#F8F7FC] selection:bg-[#8B5CF6] selection:text-white relative overflow-x-hidden">
      {/* Sticky Premium Navigation */}
      <Navbar />

      {/* Hero with Animated Workflow Visualization */}
      <Hero />

      {/* Technology Ecosystem Strip */}
      <TechStrip />

      {/* Before / After: Failures happen. Losing progress shouldn't. */}
      <ProblemSolution />

      {/* Core Capabilities: Asymmetrical Bento Grid */}
      <FeaturesBento />

      {/* How It Works: Define, Execute, Recover + SDK Code */}
      <HowItWorks />

      {/* Interactive Product Showcase Simulation */}
      <InteractiveDemo />

      {/* Developer Experience: Typed SDK, API & Control */}
      <DeveloperExperience />

      {/* Architecture Section: Decoupled Distributed Engine */}
      <ArchitectureDiagram />

      {/* Self-Hosting Section: Infrastructure Ownership */}
      <SelfHosting />

      {/* Final High-Impact Call to Action */}
      <FinalCta />

      {/* Technical Footer */}
      <Footer />
    </div>
  );
}
