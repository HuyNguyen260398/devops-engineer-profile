"use client";

import { stageCoverage } from "@/lib/roadmap/experience";
import type { RoadmapStage } from "@/types/roadmap";

export type RoadmapHeroProps = {
  stages: readonly RoadmapStage[];
  showExperience: boolean;
  onToggleExperience: () => void;
};

export function RoadmapHero({ stages, showExperience, onToggleExperience }: RoadmapHeroProps) {
  const total = stages.reduce((count, stage) => count + stage.nodes.length, 0);
  const practised = stages.reduce((count, stage) => count + stageCoverage(stage).practised, 0);

  return (
    <header className="rm-hero">
      <nav className="rm-crumbs" aria-label="Breadcrumb">
        <a href="https://nghuy.link">nghuy.link</a>
        <span aria-hidden="true">/</span>
        <span>Roadmaps</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">DevOps</span>
      </nav>

      <h1 className="rm-hero-title">DevOps Engineer Roadmap</h1>
      <p className="rm-hero-lede">
        Step by step guide to becoming a DevOps engineer in 2026: the fundamentals first, AI layered
        on top as a force multiplier — including an honest note on where it still fails.
      </p>

      <div className="rm-hero-actions">
        <button
          type="button"
          className="rm-hero-button"
          aria-pressed={showExperience}
          onClick={onToggleExperience}
        >
          <span className="rm-hero-button-dot" aria-hidden="true" />
          Show my experience
        </button>
        <a className="rm-hero-button rm-hero-button-ghost" href="https://nghuy.link">
          Back to portfolio
        </a>
      </div>

      {showExperience ? (
        <p className="rm-hero-coverage">
          Hands-on with {practised} of {total} topics — open any box for the detail.
        </p>
      ) : null}
    </header>
  );
}
