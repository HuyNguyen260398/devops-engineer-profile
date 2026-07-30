import { describe, expect, it } from "vitest";

import { IMPORTANCE_LABELS, MY_LEVEL_LABELS, findNode, stageCoverage } from "@/lib/roadmap/experience";
import type { MyLevel, RoadmapNode, RoadmapStage } from "@/types/roadmap";

function node(id: string, myLevel: MyLevel): RoadmapNode {
  return {
    id,
    title: id,
    importance: "core",
    summary: "s",
    why: "w",
    tools: ["t"],
    resources: [{ label: "r", url: "https://example.com/" }],
    myLevel,
  };
}

function stage(nodes: RoadmapNode[]): RoadmapStage {
  return {
    id: "stage",
    index: 0,
    label: "Stage",
    kicker: "STAGE 00",
    outcome: "o",
    accent: "blue",
    nodes,
  };
}

describe("stageCoverage", () => {
  it("counts production and working as practised, learning and none as not", () => {
    const result = stageCoverage(
      stage([node("a", "production"), node("b", "working"), node("c", "learning"), node("d", "none")]),
    );
    expect(result).toEqual({ practised: 2, total: 4, percent: 50 });
  });

  it("reports 100 percent when every node is practised", () => {
    expect(stageCoverage(stage([node("a", "production"), node("b", "working")]))).toEqual({
      practised: 2,
      total: 2,
      percent: 100,
    });
  });

  it("reports 0 percent when nothing is practised", () => {
    expect(stageCoverage(stage([node("a", "learning"), node("b", "none")]))).toEqual({
      practised: 0,
      total: 2,
      percent: 0,
    });
  });

  it("reports 0 percent for an empty stage instead of dividing by zero", () => {
    expect(stageCoverage(stage([]))).toEqual({ practised: 0, total: 0, percent: 0 });
  });

  it("rounds the percentage to a whole number", () => {
    expect(stageCoverage(stage([node("a", "production"), node("b", "none"), node("c", "none")])).percent).toBe(33);
  });
});

describe("findNode", () => {
  const stages = [stage([node("alpha", "production")])];

  it("finds a node by id across stages", () => {
    expect(findNode(stages, "alpha")?.id).toBe("alpha");
  });

  it("returns undefined for an unknown id", () => {
    expect(findNode(stages, "nope")).toBeUndefined();
  });
});

describe("label maps", () => {
  it("labels every experience level", () => {
    (["production", "working", "learning", "none"] as MyLevel[]).forEach((level) => {
      expect(MY_LEVEL_LABELS[level]).toBeTruthy();
    });
  });

  it("labels every importance level", () => {
    expect(IMPORTANCE_LABELS.core).toBeTruthy();
    expect(IMPORTANCE_LABELS.recommended).toBeTruthy();
    expect(IMPORTANCE_LABELS.optional).toBeTruthy();
  });
});
