import { describe, expect, it } from "vitest";

import { buildRoadmapLayout, elbowPath } from "./layout";
import { roadmapStages } from "@/data/roadmap";
import type { RoadmapNode, RoadmapStage } from "@/types/roadmap";

const node = (id: string): RoadmapNode => ({
  id,
  title: id,
  importance: "core",
  summary: "",
  why: "",
  tools: [],
  resources: [],
  myLevel: "none",
});

const stage = (id: string, index: number, nodeCount: number): RoadmapStage => ({
  id,
  index,
  label: id,
  kicker: `STAGE 0${index}`,
  outcome: "",
  accent: "blue",
  nodes: Array.from({ length: nodeCount }, (_, i) => node(`${id}-${i}`)),
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
  const stages = [stage("a", 0, 3), stage("b", 1, 5), stage("c", 2, 2)];
  const layout = buildRoadmapLayout(stages);

  it("emits one topic per stage and one subtopic per node", () => {
    expect(layout.topics).toHaveLength(3);
    expect(layout.subtopics).toHaveLength(10);
  });

  it("centres every topic box on the spine", () => {
    const spineX = layout.width / 2;
    layout.topics.forEach((topic) => {
      expect(topic.x + topic.width / 2).toBe(spineX);
    });
  });

  it("alternates the subtopic column side per stage", () => {
    const sideFor = (stageId: string) =>
      layout.subtopics.find((sub) => sub.stageId === stageId)?.side;

    expect(sideFor("a")).toBe("right");
    expect(sideFor("b")).toBe("left");
    expect(sideFor("c")).toBe("right");
  });

  it("keeps every box inside the canvas", () => {
    const boxes = [layout.title, layout.legend, ...layout.topics, ...layout.subtopics];
    boxes.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
    });
  });

  it("stacks the subtopics of a stage in order without overlapping", () => {
    const column = layout.subtopics.filter((sub) => sub.stageId === "b");
    column.forEach((sub, index) => {
      if (index === 0) return;
      expect(sub.y).toBeGreaterThanOrEqual(column[index - 1].y + column[index - 1].height);
    });
  });

  it("orders stages top to bottom down the spine", () => {
    const ys = layout.topics.map((topic) => topic.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it("draws a spine segment into every topic plus a branch to every subtopic", () => {
    expect(layout.edges.filter((edge) => edge.kind === "spine")).toHaveLength(3);
    expect(layout.edges.filter((edge) => edge.kind === "branch")).toHaveLength(10);
  });

  it("gives every edge a unique id", () => {
    const ids = layout.edges.map((edge) => edge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lays out the real roadmap without overflowing the canvas", () => {
    const real = buildRoadmapLayout(roadmapStages);
    const nodeCount = roadmapStages.reduce((total, item) => total + item.nodes.length, 0);

    expect(real.subtopics).toHaveLength(nodeCount);
    real.subtopics.forEach((sub) => {
      expect(sub.x).toBeGreaterThanOrEqual(0);
      expect(sub.x + sub.width).toBeLessThanOrEqual(real.width);
    });
  });

  it("handles a stage with no nodes", () => {
    const empty = buildRoadmapLayout([stage("solo", 0, 0)]);
    expect(empty.subtopics).toHaveLength(0);
    expect(empty.topics).toHaveLength(1);
    expect(empty.height).toBeGreaterThan(empty.topics[0].y);
  });
});
