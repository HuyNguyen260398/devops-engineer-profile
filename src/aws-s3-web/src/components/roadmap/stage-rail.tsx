"use client";

import { stageCoverage } from "@/lib/roadmap/experience";
import type { RoadmapStage } from "@/types/roadmap";

export type StageRailProps = {
  stages: readonly RoadmapStage[];
  activeStageId: string;
  showExperience: boolean;
  onSelect: (stageId: string) => void;
};

export function StageRail({ stages, activeStageId, showExperience, onSelect }: StageRailProps) {
  return (
    <nav className="rm-rail" aria-label="Roadmap stages">
      <ul className="rm-rail-list">
        {stages.map((stage) => {
          const coverage = stageCoverage(stage);

          return (
            <li key={stage.id} className="rm-rail-item">
              <button
                type="button"
                aria-current={stage.id === activeStageId ? "true" : undefined}
                onClick={() => onSelect(stage.id)}
              >
                <span className="rm-rail-index">
                  {String(stage.index).padStart(2, "0")}
                </span>
                <span>
                  {stage.label}
                  {showExperience ? (
                    <span className="rm-rail-coverage">
                      <span style={{ width: `${coverage.percent}%` }} />
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
