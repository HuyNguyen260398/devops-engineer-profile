"use client";

import { RoadmapNodeCard } from "@/components/roadmap/roadmap-node";
import { stageCoverage } from "@/lib/roadmap/experience";
import type { RoadmapStage } from "@/types/roadmap";

export type RoadmapStageSectionProps = {
  stage: RoadmapStage;
  showExperience: boolean;
  onOpenNode: (nodeId: string) => void;
};

export function RoadmapStageSection({ stage, showExperience, onOpenNode }: RoadmapStageSectionProps) {
  const coverage = stageCoverage(stage);

  return (
    <section id={stage.id} className="rm-stage" data-accent={stage.accent}>
      <span className="rm-stage-marker" aria-hidden="true" />
      <span className="rm-stage-kicker">{stage.kicker}</span>
      <h2 className="rm-stage-title">{stage.label}</h2>
      <p className="rm-stage-outcome">{stage.outcome}</p>

      {showExperience ? (
        <p className="rm-stage-coverage">
          <span className="rm-stage-coverage-bar">
            <span style={{ width: `${coverage.percent}%` }} />
          </span>
          {coverage.practised}/{coverage.total} hands-on
        </p>
      ) : null}

      <div className="rm-nodes">
        {stage.nodes.map((node) => (
          <RoadmapNodeCard
            key={node.id}
            node={node}
            showExperience={showExperience}
            onOpen={onOpenNode}
          />
        ))}
      </div>
    </section>
  );
}
