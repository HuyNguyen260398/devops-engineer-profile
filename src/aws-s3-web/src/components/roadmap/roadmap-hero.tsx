"use client";

import { allTopics, totalCoverage } from "@/lib/roadmap/experience";
import type { RoadmapStage } from "@/types/roadmap";

export type RoadmapHeroProps = {
  stages: readonly RoadmapStage[];
  showExperience: boolean;
  onToggleExperience: () => void;
};

export function RoadmapHero({ stages, showExperience, onToggleExperience }: RoadmapHeroProps) {
  const coverage = totalCoverage(stages);
  const topicCount = allTopics(stages).length;

  return (
    <header className="rm-hero">
      <nav className="rm-crumbs" aria-label="Breadcrumb">
        <a href="https://nghuy.link">nghuy.link</a>
        <span aria-hidden="true">/</span>
        <span>roadmaps</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">devops</span>
      </nav>

      <h1 className="rm-hero-title">DevOps Engineer Roadmap</h1>

      <p className="rm-hero-role">
        <span className="hero-role-prompt" aria-hidden="true">
          &gt;
        </span>{" "}
        <span aria-hidden="true">cat devops-roadmap-2026.tf</span>
        <span className="hero-role-caret" aria-hidden="true" />
      </p>

      <p className="rm-hero-lede">
        Step by step guide to becoming a DevOps engineer in 2026: the fundamentals first, AI layered
        on top as a force multiplier — including an honest note on where it still fails.
      </p>

      <div className="rm-hero-actions">
        <button
          type="button"
          className="terminal-button terminal-button-primary"
          aria-pressed={showExperience}
          onClick={onToggleExperience}
        >
          <span className="rm-hero-button-dot" aria-hidden="true" />
          Show my experience
        </button>
        <a className="terminal-button" href="https://nghuy.link">
          ← Back to portfolio
        </a>
      </div>

      <p className="rm-hero-meta">
        {stages.length} stages · {topicCount} topics · {coverage.total} subtopics
      </p>

      {showExperience ? (
        <p className="rm-hero-coverage">
          Hands-on with {coverage.practised} of {coverage.total} subtopics — open any box for the
          detail.
        </p>
      ) : null}
    </header>
  );
}
