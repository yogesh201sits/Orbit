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
import { LightPillar } from "@/components/ui/LightPillar";

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

      {/* Hero with Animated Workflow Visualization & GradientASCII background */}
      <Hero />

      {/* Below Sections with Dynamic LightPillar Purple Aurora Background */}
      <div className="relative">
        {/* Sticky background canvas that spans the below sections */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="sticky top-0 w-full h-screen">
            {/* LightPillar Luminescent Deep Purple Beam */}
            <div className="absolute inset-0">
              <LightPillar
                topColor="#9333EA"
                bottomColor="#581C87"
                intensity={1.4}
                glowAmount={0.003}
                bloom={0.4}
                pillarWidth={2.8}
                pillarHeight={0.4}
                pillarRotation={22}
                rotationSpeed={0.3}
                interactive={true}
                clickPulse={true}
                intro={true}
                quality="high"
                mixBlendMode="screen"
              />
            </div>
            {/* Top/bottom gradient blends so it flows smoothly */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#08070D] via-transparent to-[#08070D]/80 pointer-events-none" />
          </div>
        </div>

        {/* Content of below sections */}
        <div className="relative z-10">
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

          {/* Self-Hosting Section: Complete Infrastructure Independence */}
          <SelfHosting />

          {/* Final Call to Action */}
          <FinalCta />

          {/* Detailed Technical Footer */}
          <Footer />
        </div>
      </div>
    </div>
  );
}
