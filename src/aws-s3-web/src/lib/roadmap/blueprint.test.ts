import { describe, expect, it } from "vitest";

import {
  compileRoadmapBlueprint,
  validateRoadmapLayout,
  type GraphBlueprint,
} from "./blueprint";
import { roadmapStages } from "@/data/roadmap";
import { allSubtopics, allTopics } from "./experience";
import { roadmapBlueprint } from "./roadmap-blueprint";
import type { RoadmapStage } from "@/types/roadmap";

const stages: readonly RoadmapStage[] = [
  {
    id: "foundations",
    index: 0,
    label: "Foundations",
    kicker: "STAGE 00",
    outcome: "Build reliable fundamentals.",
    accent: "blue",
    topics: [
      {
        id: "linux",
        title: "Linux",
        importance: "core",
        summary: "Systems fundamentals.",
        why: "Servers run here.",
        resources: [],
        myLevel: "production",
        subtopics: [
          {
            id: "processes",
            title: "Processes",
            importance: "core",
            note: "Signals.",
            myLevel: "production",
          },
          {
            id: "permissions",
            title: "Permissions",
            importance: "core",
            note: "Access.",
            myLevel: "working",
          },
        ],
      },
    ],
  },
];

const valid: GraphBlueprint = {
  width: 1200,
  height: 800,
  root: { x: 450, y: 24, width: 300, height: 64 },
  legend: { x: 24, y: 24, width: 320, height: 130 },
  stages: [{ stageId: "foundations", x: 40, y: 190, width: 220, height: 40 }],
  clusters: [
    {
      stageId: "foundations",
      topicId: "linux",
      topic: { x: 450, y: 240, width: 300, height: 52 },
      subtopics: {
        x: 800,
        y: 210,
        columns: 1,
        columnWidth: 220,
        rowHeight: 44,
        columnGap: 12,
        rowGap: 10,
      },
      frame: { id: "linux-tools", label: "Linux building blocks", padding: 18 },
      route: "curve",
    },
  ],
};

describe("compileRoadmapBlueprint", () => {
  it("resolves topic and subtopic content into geometry", () => {
    const layout = compileRoadmapBlueprint(valid, stages);
    expect(layout.topics.map((entry) => entry.topic.id)).toEqual(["linux"]);
    expect(layout.subtopics.map((entry) => entry.subtopic.id)).toEqual(["processes", "permissions"]);
    expect(layout.groups).toEqual([
      expect.objectContaining({
        id: "linux-tools",
        label: "Linux building blocks",
        memberIds: ["processes", "permissions"],
      }),
    ]);
    expect(layout.connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "primary-root-linux",
          d: "M 600 88 C 600 164 600 164 600 240",
        }),
      ]),
    );
  });

  it("places a two-column grid in row-major order", () => {
    const twoColumnStages = structuredClone(stages);
    twoColumnStages[0].topics[0].subtopics.push(
      {
        id: "packages",
        title: "Packages",
        importance: "core",
        note: "Install.",
        myLevel: "working",
      },
      {
        id: "services",
        title: "Services",
        importance: "core",
        note: "Run.",
        myLevel: "working",
      },
    );
    const twoColumn = structuredClone(valid);
    twoColumn.clusters[0].subtopics.columns = 2;
    const compiled = compileRoadmapBlueprint(twoColumn, twoColumnStages);
    const branches = compiled.connectors.filter((connector) => connector.kind !== "primary");

    expect(compiled.subtopics.map(({ x, y }) => [x, y])).toEqual([
      [800, 210],
      [1032, 210],
      [800, 264],
      [1032, 264],
    ]);
    expect(branches.filter((connector) => !connector.waypoints)).toHaveLength(2);
    expect(branches.filter((connector) => connector.waypoints?.length === 4)).toHaveLength(2);
    expect(
      branches
        .filter((connector) => connector.waypoints)
        .every((connector) => connector.to.side === "right" && connector.route === "orthogonal"),
    ).toBe(true);
  });
});

describe("validateRoadmapLayout", () => {
  it("accepts a complete in-bounds layout", () => {
    expect(validateRoadmapLayout(compileRoadmapBlueprint(valid, stages), stages)).toEqual([]);
  });

  it.each([
    [
      "duplicate placement",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => layout.topics.push(layout.topics[0]),
      "duplicate node id: linux",
    ],
    [
      "missing topic",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => layout.topics.splice(0),
      "missing topic placement: linux",
    ],
    [
      "missing subtopic",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => layout.subtopics.splice(0),
      "missing subtopic placement: processes",
    ],
    [
      "out of bounds",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => {
        layout.subtopics[0].x = 1190;
      },
      "node outside canvas: processes",
    ],
    [
      "non-positive dimensions",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => {
        layout.topics[0].width = 0;
      },
      "invalid node dimensions: linux",
    ],
    [
      "overlapping nodes",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => {
        layout.subtopics[0].x = 700;
      },
      "overlapping nodes: linux / processes",
    ],
    [
      "group overlapping a non-member node",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => {
        layout.groups[0].x = 700;
        layout.groups[0].width = 338;
      },
      "group overlaps node: linux-tools / linux",
    ],
    [
      "unknown group member",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => {
        layout.groups[0].memberIds.push("missing");
      },
      "unknown group member: missing",
    ],
    [
      "member outside group",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => {
        layout.groups[0].width = 1;
      },
      "group member outside bounds: processes",
    ],
    [
      "unknown connector endpoint",
      (layout: ReturnType<typeof compileRoadmapBlueprint>) => {
        layout.connectors[0].to.nodeId = "missing";
      },
      "unknown connector target: missing",
    ],
  ])("reports %s", (_name, mutate, expected) => {
    const layout = compileRoadmapBlueprint(valid, stages);
    mutate(layout);
    expect(validateRoadmapLayout(layout, stages)).toContain(expected);
  });
});

describe("roadmapBlueprint", () => {
  const layout = compileRoadmapBlueprint(roadmapBlueprint, roadmapStages);

  it("resolves all original content exactly once", () => {
    expect(layout.topics).toHaveLength(allTopics(roadmapStages).length);
    expect(layout.subtopics).toHaveLength(allSubtopics(roadmapStages).length);
    expect(new Set(layout.topics.map(({ topic }) => topic.id)).size).toBe(layout.topics.length);
    expect(new Set(layout.subtopics.map(({ subtopic }) => subtopic.id)).size).toBe(
      layout.subtopics.length,
    );
  });

  it("uses four stage annotations and a multi-directional topic route", () => {
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

  it("contains framed option groups and both connector routes", () => {
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
    const routedBranches = layout.connectors.filter(
      (connector) => connector.kind !== "primary" && connector.waypoints?.length === 4,
    );
    expect(routedBranches.length).toBeGreaterThan(0);
    expect(routedBranches.every((connector) => connector.route === "orthogonal")).toBe(true);
  });

  it("keeps every topic at least 48px from its framed group", () => {
    for (const group of layout.groups) {
      const member = layout.subtopics.find(({ subtopic }) => subtopic.id === group.memberIds[0])!;
      const topic = layout.topics.find(({ topic }) => topic.id === member.topicId)!;
      const gap =
        topic.x > group.x
          ? topic.x - (group.x + group.width)
          : group.x - (topic.x + topic.width);
      expect(gap, `${topic.topic.id} -> ${group.id}`).toBeGreaterThanOrEqual(48);
    }
  });

  it("keeps every node and group within the 1440 by 7900 canvas", () => {
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

  it("validates the complete authored 2026 roadmap", () => {
    const layout = compileRoadmapBlueprint(roadmapBlueprint, roadmapStages);
    expect(validateRoadmapLayout(layout, roadmapStages)).toEqual([]);
  });
});
