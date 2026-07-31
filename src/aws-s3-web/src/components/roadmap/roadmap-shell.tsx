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
import { findNode, findStage } from "@/lib/roadmap/experience";
import { buildRoadmapLayout } from "@/lib/roadmap/layout";

type SelectionRef = { kind: "node" | "stage"; id: string };

export function RoadmapShell() {
  const [showExperience, setShowExperience] = useState(false);
  const [selected, setSelected] = useState<SelectionRef | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const layout = useMemo(() => buildRoadmapLayout(roadmapStages), []);

  const remember = () => {
    // The click target is the box on the canvas; remember it so focus returns
    // there when the panel closes.
    lastTriggerRef.current = document.activeElement as HTMLElement | null;
  };

  const openNode = useCallback((nodeId: string) => {
    remember();
    setSelected({ kind: "node", id: nodeId });
  }, []);

  const openStage = useCallback((stageId: string) => {
    remember();
    setSelected({ kind: "stage", id: stageId });
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    lastTriggerRef.current?.focus();
  }, []);

  const selection = useMemo<PanelSelection | null>(() => {
    if (!selected) return null;

    if (selected.kind === "node") {
      const node = findNode(roadmapStages, selected.id);
      return node ? { kind: "node", node } : null;
    }

    const stage = findStage(roadmapStages, selected.id);
    return stage ? { kind: "stage", stage } : null;
  }, [selected]);

  return (
    <div className="site-shell rm-page">
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
          onOpenNode={openNode}
          onOpenStage={openStage}
        />
      </main>

      <RoadmapDetailPanel
        selection={selection}
        showExperience={showExperience}
        onClose={close}
        // Jumping from a stage panel to one of its topics keeps the panel open,
        // so the original trigger stays the focus target.
        onOpenNode={(nodeId) => setSelected({ kind: "node", id: nodeId })}
      />
    </div>
  );
}
