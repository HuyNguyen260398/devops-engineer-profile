export type NodeImportance = "core" | "recommended" | "optional";

export type MyLevel = "production" | "working" | "learning" | "none";

export type StageAccent = "blue" | "green" | "ai" | "violet";

export type RoadmapResource = {
  label: string;
  url: string;
};

/**
 * A leaf on the graph: the concrete tool or concept that branches off a topic.
 * Kept deliberately thin — one line is what a branch box can usefully carry.
 */
export type RoadmapSubtopic = {
  /** url-safe, stable, unique across the whole roadmap */
  id: string;
  title: string;
  importance: NodeImportance;
  /** one line on what it is and where it shows up in the job */
  note: string;
  /** the author's real experience, surfaced only by the experience overlay */
  myLevel: MyLevel;
};

/** A box on the central spine, with its own branch column. */
export type RoadmapTopic = {
  id: string;
  title: string;
  importance: NodeImportance;
  /** one line, shown at the top of the detail panel */
  summary: string;
  /** why it matters in 2026 */
  why: string;
  resources: readonly RoadmapResource[];
  myLevel: MyLevel;
  subtopics: readonly RoadmapSubtopic[];
};

/** A run of topics, marked on the spine by a divider label. */
export type RoadmapStage = {
  id: string;
  index: number;
  label: string;
  /** mono eyebrow, e.g. "STAGE 02" */
  kicker: string;
  /** what you can do once this stage is behind you */
  outcome: string;
  accent: StageAccent;
  topics: readonly RoadmapTopic[];
};
