import { describe, expect, it } from "vitest";

import {
  compileRoadmapBlueprint,
  validateRoadmapLayout,
  type GraphBlueprint,
} from "./blueprint";
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
    const twoColumn = structuredClone(valid);
    twoColumn.clusters[0].subtopics.columns = 2;
    const layout = compileRoadmapBlueprint(twoColumn, stages);
    expect(layout.subtopics.map(({ x, y }) => [x, y])).toEqual([
      [800, 210],
      [1032, 210],
    ]);
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
