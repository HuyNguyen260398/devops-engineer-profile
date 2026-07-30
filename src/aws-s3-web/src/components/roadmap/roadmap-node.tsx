"use client";

import { IMPORTANCE_LABELS, MY_LEVEL_LABELS } from "@/lib/roadmap/experience";
import type { RoadmapNode } from "@/types/roadmap";

export type RoadmapNodeCardProps = {
  node: RoadmapNode;
  showExperience: boolean;
  onOpen: (nodeId: string) => void;
};

export function RoadmapNodeCard({ node, showExperience, onOpen }: RoadmapNodeCardProps) {
  return (
    <button
      type="button"
      className="rm-node"
      data-importance={node.importance}
      data-level={showExperience ? node.myLevel : undefined}
      onClick={() => onOpen(node.id)}
    >
      <span className="rm-node-head">
        <span className="rm-node-title">{node.title}</span>
        <span className="rm-node-importance">{IMPORTANCE_LABELS[node.importance]}</span>
      </span>
      <span className="rm-node-summary">{node.summary}</span>
      {showExperience ? (
        <span className="rm-node-level">{MY_LEVEL_LABELS[node.myLevel]}</span>
      ) : null}
    </button>
  );
}
