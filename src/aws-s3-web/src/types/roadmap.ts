export type NodeImportance = "core" | "recommended" | "optional";

export type MyLevel = "production" | "working" | "learning" | "none";

export type StageAccent = "blue" | "green" | "ai" | "violet";

export type RoadmapResource = {
  label: string;
  url: string;
};

export type RoadmapNode = {
  /** url-safe, stable, unique across the whole roadmap */
  id: string;
  title: string;
  importance: NodeImportance;
  /** one line, shown on the card */
  summary: string;
  /** why it matters in 2026, shown in the detail panel */
  why: string;
  tools: readonly string[];
  resources: readonly RoadmapResource[];
  /** author's real experience, surfaced only by the experience overlay */
  myLevel: MyLevel;
};

export type RoadmapStage = {
  id: string;
  index: number;
  label: string;
  /** mono eyebrow, e.g. "STAGE 02" */
  kicker: string;
  /** what you can do once this stage is behind you */
  outcome: string;
  accent: StageAccent;
  nodes: readonly RoadmapNode[];
};
