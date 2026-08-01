import { describe, expect, it } from "vitest";

import { buildRoadmapLayout, elbowPath } from "./layout";
import { roadmapStages } from "@/data/roadmap";
import type { RoadmapStage, RoadmapSubtopic, RoadmapTopic } from "@/types/roadmap";

const subtopic = (id: string): RoadmapSubtopic => ({
  id,
  title: id,
  importance: "core",
  note: "",
  myLevel: "none",
});

const topic = (id: string, subtopicCount: number): RoadmapTopic => ({
  id,
  title: id,
  importance: "core",
  summary: "",
  why: "",
  resources: [],
  myLevel: "none",
  subtopics: Array.from({ length: subtopicCount }, (_, i) => subtopic(`${id}-${i}`)),
});

const stage = (id: string, index: number, topicSizes: number[]): RoadmapStage => ({
  id,
  index,
  label: id,
  kicker: `STAGE 0${index}`,
  outcome: "",
  accent: "blue",
  topics: topicSizes.map((size, i) => topic(`${id}-t${i}`, size)),
});

describe("elbowPath", () => {
  it("draws a straight line when the two ends share a row", () => {
    expect(elbowPath(0, 50, 100, 50)).toBe("M 0 50 L 100 50");
  });

  it("routes through the midline with rounded corners when the ends differ", () => {
    const d = elbowPath(0, 0, 100, 100);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.endsWith("L 100 100")).toBe(true);
    expect(d.split("Q")).toHaveLength(3);
  });

  it("keeps the corner radius inside a very short rise", () => {
    // A 2px rise must not produce a 16px radius that overshoots the endpoint.
    const d = elbowPath(0, 0, 100, 2);
    expect(d).toContain("Q 50 0 50 1");
    expect(d).toContain("Q 50 2 51 2");
  });

  it("mirrors the horizontal direction when the target is to the left", () => {
    const d = elbowPath(100, 0, 0, 100);
    expect(d).toContain("L 66 0");
    expect(d.endsWith("L 0 100")).toBe(true);
  });
});

describe("buildRoadmapLayout", () => {
  const stages = [stage("a", 0, [3, 5]), stage("b", 1, [2, 6, 4])];
  const layout = buildRoadmapLayout(stages);

  it("emits a divider per stage, a box per topic, and a box per subtopic", () => {
    expect(layout.stageLabels).toHaveLength(2);
    expect(layout.topics).toHaveLength(5);
    expect(layout.subtopics).toHaveLength(20);
  });

  it("centres every topic box and stage divider on the spine", () => {
    const spineX = layout.width / 2;
    [...layout.topics, ...layout.stageLabels].forEach((box) => {
      expect(box.x + box.width / 2).toBe(spineX);
    });
  });

  it("alternates the branch side per topic, continuing across stage boundaries", () => {
    expect(layout.topics.map((entry) => entry.side)).toEqual([
      "right",
      "left",
      "right",
      "left",
      "right",
    ]);
  });

  it("keeps every box inside the canvas", () => {
    const boxes = [
      layout.title,
      layout.legend,
      ...layout.stageLabels,
      ...layout.topics,
      ...layout.subtopics,
    ];
    boxes.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
    });
  });

  it("stacks a topic's subtopics in order without overlapping", () => {
    const column = layout.subtopics.filter((entry) => entry.topicId === "b-t1");
    expect(column).toHaveLength(6);
    column.forEach((entry, index) => {
      if (index === 0) return;
      expect(entry.y).toBeGreaterThanOrEqual(column[index - 1].y + column[index - 1].height);
    });
  });

  it("never overlaps two columns that share a side", () => {
    (["left", "right"] as const).forEach((side) => {
      const onSide = layout.subtopics.filter((entry) => entry.side === side);
      const byTopic = new Map<string, { top: number; bottom: number }>();

      onSide.forEach((entry) => {
        const span = byTopic.get(entry.topicId) ?? { top: Infinity, bottom: -Infinity };
        byTopic.set(entry.topicId, {
          top: Math.min(span.top, entry.y),
          bottom: Math.max(span.bottom, entry.y + entry.height),
        });
      });

      const spans = [...byTopic.values()].sort((a, b) => a.top - b.top);
      spans.forEach((span, index) => {
        if (index === 0) return;
        expect(span.top).toBeGreaterThanOrEqual(spans[index - 1].bottom);
      });
    });
  });

  it("orders topics and dividers top to bottom down the spine", () => {
    const ys = layout.topics.map((entry) => entry.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));

    layout.stageLabels.forEach((label) => {
      const inStage = layout.topics.filter((entry) => entry.stageId === label.stage.id);
      inStage.forEach((entry) => expect(entry.y).toBeGreaterThan(label.y));
    });
  });

  it("draws a spine segment per divider and per topic, plus a branch per subtopic", () => {
    expect(layout.edges.filter((edge) => edge.kind === "spine")).toHaveLength(7);
    expect(layout.edges.filter((edge) => edge.kind === "branch")).toHaveLength(20);
  });

  it("gives every edge a unique id", () => {
    const ids = layout.edges.map((edge) => edge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("packs alternating columns tighter than stacking them would", () => {
    // Two topics of five subtopics each, branching opposite ways, must not need
    // the full height of both columns.
    const packed = buildRoadmapLayout([stage("x", 0, [5, 5])]);
    const stacked = buildRoadmapLayout([stage("y", 0, [5]), stage("z", 1, [5])]);
    expect(packed.height).toBeLessThan(stacked.height);
  });

  it("lays out the real roadmap without overflowing the canvas", () => {
    const real = buildRoadmapLayout(roadmapStages);
    const subtopicCount = roadmapStages.reduce(
      (total, item) => total + item.topics.reduce((sum, t) => sum + t.subtopics.length, 0),
      0,
    );

    expect(real.subtopics).toHaveLength(subtopicCount);
    real.subtopics.forEach((entry) => {
      expect(entry.x).toBeGreaterThanOrEqual(0);
      expect(entry.x + entry.width).toBeLessThanOrEqual(real.width);
    });
  });

  it("handles a topic with no subtopics", () => {
    const empty = buildRoadmapLayout([stage("solo", 0, [0])]);
    expect(empty.subtopics).toHaveLength(0);
    expect(empty.topics).toHaveLength(1);
    expect(empty.height).toBeGreaterThan(empty.topics[0].y);
  });
});
