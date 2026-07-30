"use client";

import { useCallback, useRef, useState } from "react";

import { NodeDetailPanel } from "@/components/roadmap/node-detail-panel";
import { RoadmapTrack } from "@/components/roadmap/roadmap-track";
import { StageRail } from "@/components/roadmap/stage-rail";
import { ThemeToggle } from "@/components/theme-toggle";
import { roadmapStages } from "@/data/roadmap";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { findNode } from "@/lib/roadmap/experience";

export function RoadmapShell() {
  const [showExperience, setShowExperience] = useState(false);
  const [activeStageId, setActiveStageId] = useState(roadmapStages[0].id);
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();

  const openNode = useCallback((nodeId: string) => {
    // The click target is the card button; remember it so focus can return.
    lastTriggerRef.current = document.activeElement as HTMLElement | null;
    setOpenNodeId(nodeId);
  }, []);

  const closeNode = useCallback(() => {
    setOpenNodeId(null);
    lastTriggerRef.current?.focus();
  }, []);

  const selectStage = useCallback(
    (stageId: string) => {
      setActiveStageId(stageId);
      document.getElementById(stageId)?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    },
    [reducedMotion],
  );

  return (
    <div className="site-shell rm-page">
      <div className="grid-backdrop" aria-hidden="true" />
      <ThemeToggle />

      <main className="rm-inner">
        <header className="rm-header">
          <span className="rm-kicker">DEVOPS :: ROADMAP 2026</span>
          <h1 className="rm-title">DevOps Engineer Roadmap</h1>
          <p className="rm-lede">
            What actually matters in 2026: the fundamentals first, AI layered on top as a force
            multiplier — including an honest note on where it still fails.
          </p>

          <div className="rm-header-actions">
            <button
              type="button"
              className="rm-toggle"
              aria-pressed={showExperience}
              onClick={() => setShowExperience((value) => !value)}
            >
              <span className="rm-toggle-dot" aria-hidden="true" />
              Show my experience
            </button>
            <a className="rm-home-link" href="https://nghuy.link">
              ← nghuy.link
            </a>
          </div>
        </header>

        <div className="rm-body">
          <StageRail
            stages={roadmapStages}
            activeStageId={activeStageId}
            showExperience={showExperience}
            onSelect={selectStage}
          />
          <RoadmapTrack
            stages={roadmapStages}
            showExperience={showExperience}
            onOpenNode={openNode}
            onActiveStageChange={setActiveStageId}
          />
        </div>
      </main>

      <NodeDetailPanel
        node={openNodeId ? (findNode(roadmapStages, openNodeId) ?? null) : null}
        showExperience={showExperience}
        onClose={closeNode}
      />
    </div>
  );
}
