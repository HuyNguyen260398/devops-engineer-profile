"use client";

import { useEffect } from "react";

import { RoadmapStageSection } from "@/components/roadmap/roadmap-stage";
import type { RoadmapStage } from "@/types/roadmap";

export type RoadmapTrackProps = {
  stages: readonly RoadmapStage[];
  showExperience: boolean;
  onOpenNode: (nodeId: string) => void;
  onActiveStageChange: (stageId: string) => void;
};

export function RoadmapTrack({
  stages,
  showExperience,
  onOpenNode,
  onActiveStageChange,
}: RoadmapTrackProps) {
  useEffect(() => {
    // jsdom has no IntersectionObserver; the rail simply stays on its initial
    // stage in that environment. Same guard as use-active-section.ts.
    if (typeof IntersectionObserver === "undefined") return;

    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let bestId: string | undefined;
        let bestRatio = 0;
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });

        if (bestId) onActiveStageChange(bestId);
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0, 0.2, 0.5, 0.8] },
    );

    stages.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, [stages, onActiveStageChange]);

  return (
    <div className="rm-track">
      <span className="rm-spine" aria-hidden="true" />
      {stages.map((stage) => (
        <RoadmapStageSection
          key={stage.id}
          stage={stage}
          showExperience={showExperience}
          onOpenNode={onOpenNode}
        />
      ))}
    </div>
  );
}
