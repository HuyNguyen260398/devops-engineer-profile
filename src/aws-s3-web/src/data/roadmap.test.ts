import { describe, expect, it } from "vitest";

import { portfolio } from "@/data/portfolio";
import { roadmapStages } from "@/data/roadmap";
import type { MyLevel, NodeImportance, RoadmapNode } from "@/types/roadmap";

const IMPORTANCE: NodeImportance[] = ["core", "recommended", "optional"];
const LEVELS: MyLevel[] = ["production", "working", "learning", "none"];
const allNodes = roadmapStages.flatMap((stage) => stage.nodes);

// A skill claimed on the portfolio must not be marked unpractised on the
// roadmap. Matches on exact tool equality or a whole-word title match, so
// "Git" does not spuriously match "GitHub Actions".
function driftViolations(
  skills: readonly { label: string }[],
  nodes: readonly RoadmapNode[],
): string[] {
  const violations: string[] = [];

  skills.forEach((skill) => {
    const label = skill.label.toLowerCase();
    const titlePattern = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

    nodes.forEach((node) => {
      const matches =
        node.tools.some((tool) => tool.toLowerCase() === label) || titlePattern.test(node.title);
      if (matches && node.myLevel === "none") {
        violations.push(`${skill.label} -> ${node.id}`);
      }
    });
  });

  return violations;
}

function makeNode(overrides: Partial<RoadmapNode> & Pick<RoadmapNode, "id">): RoadmapNode {
  return {
    title: "Synthetic node",
    importance: "core",
    summary: "Synthetic summary.",
    why: "Synthetic why.",
    tools: [],
    resources: [{ label: "Example", url: "https://example.com/" }],
    myLevel: "none",
    ...overrides,
  };
}

describe("roadmap stages", () => {
  it("has four stages with contiguous, ordered indexes", () => {
    expect(roadmapStages).toHaveLength(4);
    expect(roadmapStages.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it("has unique, url-safe stage ids", () => {
    const ids = roadmapStages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
  });

  it("gives every stage a label, kicker, and outcome", () => {
    roadmapStages.forEach((stage) => {
      expect(stage.label.length).toBeGreaterThan(0);
      expect(stage.kicker.length).toBeGreaterThan(0);
      expect(stage.outcome.length).toBeGreaterThan(0);
    });
  });

  it("includes exactly one AI-accented stage", () => {
    expect(roadmapStages.filter((s) => s.accent === "ai")).toHaveLength(1);
  });
});

describe("roadmap nodes", () => {
  it("has unique, url-safe node ids across all stages", () => {
    const ids = allNodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
  });

  it("gives every node a title, summary, why, and at least one tool", () => {
    allNodes.forEach((node) => {
      expect(node.title.length, node.id).toBeGreaterThan(0);
      expect(node.summary.length, node.id).toBeGreaterThan(0);
      expect(node.why.length, node.id).toBeGreaterThan(0);
      expect(node.tools.length, node.id).toBeGreaterThan(0);
    });
  });

  it("gives every node at least one absolute https resource", () => {
    allNodes.forEach((node) => {
      expect(node.resources.length, node.id).toBeGreaterThan(0);
      node.resources.forEach((resource) => {
        expect(resource.label.length, node.id).toBeGreaterThan(0);
        expect(resource.url, node.id).toMatch(/^https:\/\//);
        expect(() => new URL(resource.url)).not.toThrow();
      });
    });
  });

  it("uses only known importance and experience values", () => {
    allNodes.forEach((node) => {
      expect(IMPORTANCE, node.id).toContain(node.importance);
      expect(LEVELS, node.id).toContain(node.myLevel);
    });
  });
});

describe("portfolio drift", () => {
  it("never marks a claimed portfolio skill as myLevel 'none'", () => {
    expect(driftViolations(portfolio.skills, allNodes)).toEqual([]);
  });

  it("detects a title match", () => {
    const node = makeNode({ id: "synthetic-title-match", title: "Kubernetes", myLevel: "none" });
    const violations = driftViolations([{ label: "Kubernetes" }], [node]);
    expect(violations).toEqual(["Kubernetes -> synthetic-title-match"]);
  });

  it("detects an exact tool match", () => {
    const node = makeNode({
      id: "synthetic-tool-match",
      title: "Unrelated title",
      tools: ["Terraform"],
      myLevel: "none",
    });
    const violations = driftViolations([{ label: "Terraform" }], [node]);
    expect(violations).toEqual(["Terraform -> synthetic-tool-match"]);
  });

  it("respects whole-word title boundaries", () => {
    const node = makeNode({
      id: "synthetic-github-actions",
      title: "GitHub Actions",
      tools: ["GitHub Actions"],
      myLevel: "none",
    });
    const violations = driftViolations([{ label: "Git" }], [node]);
    expect(violations).toEqual([]);
  });

  it("ignores practised nodes", () => {
    const node = makeNode({ id: "synthetic-title-match", title: "Kubernetes", myLevel: "production" });
    const violations = driftViolations([{ label: "Kubernetes" }], [node]);
    expect(violations).toEqual([]);
  });
});
