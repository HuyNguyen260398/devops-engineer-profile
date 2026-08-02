import type { RoadmapStage } from "@/types/roadmap";

import { compileRoadmapBlueprint } from "./blueprint";
import { roadmapBlueprint } from "./roadmap-blueprint";

export * from "./blueprint";

export function buildRoadmapLayout(stages: readonly RoadmapStage[]) {
  return compileRoadmapBlueprint(roadmapBlueprint, stages);
}
