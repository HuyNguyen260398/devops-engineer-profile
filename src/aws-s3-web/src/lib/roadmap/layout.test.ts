import { describe, expect, it } from "vitest";

import { roadmapStages } from "@/data/roadmap";
import { allSubtopics, allTopics } from "./experience";
import { buildRoadmapLayout } from "./layout";

describe("buildRoadmapLayout", () => {
  const layout = buildRoadmapLayout(roadmapStages);

  it("resolves every original topic and subtopic exactly once", () => {
    expect(layout.topics).toHaveLength(allTopics(roadmapStages).length);
    expect(layout.subtopics).toHaveLength(allSubtopics(roadmapStages).length);
    expect(new Set(layout.topics.map(({ topic }) => topic.id)).size).toBe(layout.topics.length);
    expect(new Set(layout.subtopics.map(({ subtopic }) => subtopic.id)).size).toBe(
      layout.subtopics.length,
    );
  });

  it("uses four ordered stage annotations and a multi-directional topic route", () => {
    expect(layout.stages.map(({ stage }) => stage.id)).toEqual([
      "foundations",
      "modern-devops",
      "ai-layer",
      "senior-impact",
    ]);
    expect(new Set(layout.topics.map(({ x }) => x)).size).toBeGreaterThanOrEqual(5);
    const routeDirections = layout.topics.slice(1).map((topic, index) =>
      Math.sign(topic.x - layout.topics[index].x),
    );
    expect(routeDirections).toContain(-1);
    expect(routeDirections).toContain(1);
  });

  it("contains named frames and both connector routes", () => {
    expect(layout.groups.length).toBeGreaterThanOrEqual(10);
    expect(layout.groups.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "programming-options",
        "cloud-platform",
        "kubernetes-building-blocks",
        "delivery-toolchain",
        "observability-signals",
        "ai-platform",
      ]),
    );
    expect(new Set(layout.connectors.map(({ route }) => route))).toEqual(
      new Set(["curve", "orthogonal"]),
    );
  });

  it("keeps every box inside the 1440 by 7900 canvas", () => {
    expect(layout.width).toBe(1440);
    expect(layout.height).toBe(7900);
    for (const box of [
      layout.root,
      layout.legend,
      ...layout.stages,
      ...layout.topics,
      ...layout.subtopics,
      ...layout.groups,
    ]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
    }
  });
});
