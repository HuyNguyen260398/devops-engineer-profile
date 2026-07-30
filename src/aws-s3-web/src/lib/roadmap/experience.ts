import type { MyLevel, NodeImportance, RoadmapNode, RoadmapStage } from "@/types/roadmap";

export const MY_LEVEL_LABELS: Record<MyLevel, string> = {
  production: "Production experience",
  working: "Working knowledge",
  learning: "Currently learning",
  none: "Not yet",
};

export const IMPORTANCE_LABELS: Record<NodeImportance, string> = {
  core: "Core",
  recommended: "Recommended",
  optional: "Optional",
};

/** Levels that count as hands-on rather than aspirational. */
const PRACTISED: readonly MyLevel[] = ["production", "working"];

export type StageCoverage = {
  practised: number;
  total: number;
  percent: number;
};

export function stageCoverage(stage: RoadmapStage): StageCoverage {
  const total = stage.nodes.length;
  const practised = stage.nodes.filter((node) => PRACTISED.includes(node.myLevel)).length;
  const percent = total === 0 ? 0 : Math.round((practised / total) * 100);

  return { practised, total, percent };
}

export function findNode(
  stages: readonly RoadmapStage[],
  nodeId: string,
): RoadmapNode | undefined {
  for (const stage of stages) {
    const found = stage.nodes.find((node) => node.id === nodeId);
    if (found) return found;
  }
  return undefined;
}
