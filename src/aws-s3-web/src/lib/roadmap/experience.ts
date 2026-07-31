import type {
  MyLevel,
  NodeImportance,
  RoadmapStage,
  RoadmapSubtopic,
  RoadmapTopic,
} from "@/types/roadmap";

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

/**
 * The roadmap.sh legend, restated for this roadmap. The colours are the ones
 * roadmap.sh uses for its three legend entries, so the graph reads the same way
 * to anyone who has seen the original.
 */
export const LEGEND_ENTRIES: readonly {
  importance: NodeImportance;
  color: string;
  label: string;
}[] = [
  { importance: "core", color: "#874efe", label: "Core — non-negotiable in 2026" },
  { importance: "recommended", color: "#c69b0b", label: "Recommended — strong differentiator" },
  { importance: "optional", color: "#949494", label: "Order not strict — learn anytime" },
];

/** Levels that count as hands-on rather than aspirational. */
const PRACTISED: readonly MyLevel[] = ["production", "working"];

export type Coverage = {
  practised: number;
  total: number;
  percent: number;
};

function coverageOf(levels: readonly MyLevel[]): Coverage {
  const total = levels.length;
  const practised = levels.filter((level) => PRACTISED.includes(level)).length;
  const percent = total === 0 ? 0 : Math.round((practised / total) * 100);

  return { practised, total, percent };
}

/** Coverage across a topic's own subtopics. */
export function topicCoverage(topic: RoadmapTopic): Coverage {
  return coverageOf(topic.subtopics.map((subtopic) => subtopic.myLevel));
}

/** Coverage across every subtopic in a stage, topic boxes excluded. */
export function stageCoverage(stage: RoadmapStage): Coverage {
  return coverageOf(
    stage.topics.flatMap((topic) => topic.subtopics.map((subtopic) => subtopic.myLevel)),
  );
}

/** Coverage across the whole roadmap. */
export function totalCoverage(stages: readonly RoadmapStage[]): Coverage {
  return coverageOf(
    stages.flatMap((stage) =>
      stage.topics.flatMap((topic) => topic.subtopics.map((subtopic) => subtopic.myLevel)),
    ),
  );
}

export function allTopics(stages: readonly RoadmapStage[]): readonly RoadmapTopic[] {
  return stages.flatMap((stage) => stage.topics);
}

export function allSubtopics(stages: readonly RoadmapStage[]): readonly RoadmapSubtopic[] {
  return stages.flatMap((stage) => stage.topics.flatMap((topic) => topic.subtopics));
}

export function findStage(
  stages: readonly RoadmapStage[],
  stageId: string,
): RoadmapStage | undefined {
  return stages.find((stage) => stage.id === stageId);
}

export function findTopic(
  stages: readonly RoadmapStage[],
  topicId: string,
): RoadmapTopic | undefined {
  return allTopics(stages).find((topic) => topic.id === topicId);
}

/** Returns the subtopic and the topic it branches off, since the panel shows both. */
export function findSubtopic(
  stages: readonly RoadmapStage[],
  subtopicId: string,
): { subtopic: RoadmapSubtopic; topic: RoadmapTopic } | undefined {
  for (const topic of allTopics(stages)) {
    const subtopic = topic.subtopics.find((item) => item.id === subtopicId);
    if (subtopic) return { subtopic, topic };
  }
  return undefined;
}
