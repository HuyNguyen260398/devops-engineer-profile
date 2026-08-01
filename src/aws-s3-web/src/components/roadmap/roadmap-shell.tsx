"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { RoadmapCanvas } from "@/components/roadmap/roadmap-canvas";
import {
  RoadmapDetailPanel,
  type PanelSelection,
} from "@/components/roadmap/roadmap-detail-panel";
import { RoadmapHero } from "@/components/roadmap/roadmap-hero";
import { ThemeToggle } from "@/components/theme-toggle";
import { roadmapStages } from "@/data/roadmap";
import { findStage, findSubtopic, findTopic } from "@/lib/roadmap/experience";
import { buildRoadmapLayout } from "@/lib/roadmap/layout";

type SelectionRef = { kind: "stage" | "topic" | "subtopic"; id: string };

export function RoadmapShell() {
  const [showExperience, setShowExperience] = useState(false);
  const [selected, setSelected] = useState<SelectionRef | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const layout = useMemo(() => buildRoadmapLayout(roadmapStages), []);

  // Opening from the canvas remembers the box so focus can return to it;
  // navigating inside the panel must not overwrite that.
  const openFromCanvas = useCallback((kind: SelectionRef["kind"], id: string) => {
    lastTriggerRef.current = document.activeElement as HTMLElement | null;
    setSelected({ kind, id });
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    lastTriggerRef.current?.focus();
  }, []);

  const selection = useMemo<PanelSelection | null>(() => {
    if (!selected) return null;

    if (selected.kind === "stage") {
      const stage = findStage(roadmapStages, selected.id);
      return stage ? { kind: "stage", stage } : null;
    }

    if (selected.kind === "topic") {
      const topic = findTopic(roadmapStages, selected.id);
      return topic ? { kind: "topic", topic } : null;
    }

    const found = findSubtopic(roadmapStages, selected.id);
    return found ? { kind: "subtopic", ...found } : null;
  }, [selected]);

  return (
    <div className="site-shell rm-page">
      <div className="grid-backdrop" aria-hidden="true" />
      <ThemeToggle />

      <main className="rm-inner">
        <RoadmapHero
          stages={roadmapStages}
          showExperience={showExperience}
          onToggleExperience={() => setShowExperience((value) => !value)}
        />

        <RoadmapCanvas
          layout={layout}
          showExperience={showExperience}
          onOpenStage={(id) => openFromCanvas("stage", id)}
          onOpenTopic={(id) => openFromCanvas("topic", id)}
          onOpenSubtopic={(id) => openFromCanvas("subtopic", id)}
        />
      </main>

      <RoadmapDetailPanel
        selection={selection}
        showExperience={showExperience}
        onClose={close}
        onOpenTopic={(id) => setSelected({ kind: "topic", id })}
        onOpenSubtopic={(id) => setSelected({ kind: "subtopic", id })}
      />
    </div>
  );
}
