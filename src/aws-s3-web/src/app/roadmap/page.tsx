import type { Metadata } from "next";

import { RoadmapShell } from "@/components/roadmap/roadmap-shell";

import "./roadmap.css";

export const metadata: Metadata = {
  title: "DevOps Engineer Roadmap 2026",
  description:
    "A 2026 DevOps engineer roadmap: foundations, modern DevOps, the AI layer (AIOps, LLMOps, MCP), and senior platform impact.",
  alternates: {
    // The page is reachable at both nghuy.link/roadmap and the subdomain; the
    // subdomain is canonical.
    canonical: "https://roadmap.nghuy.link/",
  },
};

export default function RoadmapPage() {
  return <RoadmapShell />;
}
