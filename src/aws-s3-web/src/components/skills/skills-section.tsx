"use client";

import dynamic from "next/dynamic";
import { Rotate3D } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { SectionHeading } from "@/components/section-heading";
import { portfolio } from "@/data/portfolio";
import { sectionIcons } from "@/components/section-icons";

const SkillsCanvas = dynamic(() => import("./skills-canvas"), {
  ssr: false,
  loading: () => <div className="skills-loading">Initializing skills universe...</div>,
});

class CanvasBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Skills canvas unavailable", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function SkillsSection({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const fallback = (
    <div className="skills-fallback" role="status">
      Interactive 3D is unavailable. The complete skills list remains available to screen readers.
    </div>
  );

  return (
    <section className="page-section skills-section" id="skills" aria-labelledby="skills-heading">
      <div id="skills-heading"><SectionHeading prefix="#" title="Skills.json" icon={sectionIcons.skills} /></div>
      <div className="skills-stage skills-stage--floating" data-testid="skills-stage">
        {reducedMotion ? (
          <div className="skills-reduced">
            <Rotate3D aria-hidden="true" size={28} />
            <p>Reduced motion mode — interactive rotation is paused.</p>
          </div>
        ) : (
          <CanvasBoundary fallback={fallback}>
            <SkillsCanvas reducedMotion={reducedMotion} />
          </CanvasBoundary>
        )}
      </div>
      <ul className="sr-only" aria-label="Technology skills">
        {portfolio.skills.map((skill) => (
          <li key={skill.label}><span style={{ background: skill.color }} />{skill.label}</li>
        ))}
      </ul>
    </section>
  );
}
