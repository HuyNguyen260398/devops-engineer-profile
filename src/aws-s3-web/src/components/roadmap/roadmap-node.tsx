"use client";

import { IMPORTANCE_LABELS, MY_LEVEL_LABELS } from "@/lib/roadmap/experience";
import type { ResolvedSubtopic } from "@/lib/roadmap/blueprint";

export type RoadmapNodeCardProps = {
  subtopic: ResolvedSubtopic;
  showExperience: boolean;
  onOpen: (subtopicId: string) => void;
};

/**
 * A subtopic box on the canvas: label only, roadmap.sh style. Everything else
 * about it lives in the detail panel.
 */
export function RoadmapNodeCard({ subtopic, showExperience, onOpen }: RoadmapNodeCardProps) {
  const { subtopic: node } = subtopic;

  return (
    <button
      type="button"
      className="rm-box rm-subtopic"
      data-importance={node.importance}
      data-level={showExperience ? node.myLevel : undefined}
      style={{
        left: subtopic.x,
        top: subtopic.y,
        width: subtopic.width,
        height: subtopic.height,
      }}
      title={`${IMPORTANCE_LABELS[node.importance]} — ${node.note}`}
      onClick={() => onOpen(node.id)}
    >
      <span className="rm-box-label">{node.title}</span>
      {showExperience && node.myLevel !== "none" ? (
        <span className="rm-box-badge" aria-hidden="true" />
      ) : null}
      {showExperience ? (
        // Inline spans concatenate with no separator in the accessible name, so
        // the comma has to be part of the text.
        <span className="rm-sr-only">{`, ${MY_LEVEL_LABELS[node.myLevel]}`}</span>
      ) : null}
    </button>
  );
}
