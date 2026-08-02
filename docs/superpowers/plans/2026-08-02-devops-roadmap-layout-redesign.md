# DevOps Roadmap 2026 Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simple alternating-spine roadmap with a dense, authored, terminal-themed DevOps 2026 flowchart while preserving all original content, experience annotations, and detail-panel interactions.

**Architecture:** Keep `src/data/roadmap.ts` as the content source and introduce a typed cluster blueprint that owns geometry only. Compile that blueprint into resolved topic/subtopic boxes, framed groups, stage annotations, and connector paths in one coordinate plane; render SVG decoration below accessible HTML buttons and scale the complete poster responsively.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, route-scoped CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Execute on `feat/roadmap-subdomain`, not `main`; create an isolated worktree with `superpowers:using-git-worktrees` before implementation.
- Preserve every existing stage, topic, subtopic, resource, importance tier, and experience annotation in `src/data/roadmap.ts`.
- Do not copy roadmap.sh text, images, assets, source coordinates, raw SVG paths, or CSS.
- Keep the existing portfolio hero, terminal titlebar, theme toggle, light/dark modes, and route-scoped stylesheet.
- Keep **Show my experience** off by default and ensure toggling it never changes graph geometry or scroll position.
- Keep topic, subtopic, and stage controls as accessible HTML buttons; decorative SVG remains `aria-hidden="true"`.
- Keep the existing modal focus trap, Escape close, explicit close, and focus restoration behavior.
- Desktop/tablet must scale one stable topology; narrow screens must stop at a readable minimum scale and pan horizontally without document-level overflow.
- Add no connector-draw animation; preserve the existing reduced-motion-safe
  detail-panel behavior and introduce no motion-dependent state.
- Add no runtime dependency and make no infrastructure, CloudFront, API, authentication, or persistence change.
- Preserve the user's unrelated `.gitignore` modification; never stage or commit it.

---

## File Structure

### Create

- `src/aws-s3-web/src/lib/roadmap/blueprint.ts` — geometry types, cluster compiler, content resolution, and invariant validation.
- `src/aws-s3-web/src/lib/roadmap/blueprint.test.ts` — synthetic validation/compiler tests plus whole-roadmap coverage.
- `src/aws-s3-web/src/lib/roadmap/roadmap-blueprint.ts` — the 24 authored topic clusters, root, legend, and four stage annotations.
- `src/aws-s3-web/src/lib/roadmap/connector-path.ts` — connector anchor resolution and curve/orthogonal path generation.
- `src/aws-s3-web/src/lib/roadmap/connector-path.test.ts` — exact path tests for every routing mode.

### Modify

- `src/aws-s3-web/src/lib/roadmap/layout.ts` — replace the alternating-spine algorithm with a small adapter that compiles `roadmapBlueprint` and re-export resolved layout types.
- `src/aws-s3-web/src/lib/roadmap/layout.test.ts` — remove obsolete spine/alternation assertions and assert the resolved real topology.
- `src/aws-s3-web/src/components/roadmap/roadmap-canvas.tsx` — render root, stage annotations, group frames, routed connectors, topics, and subtopics in layered order.
- `src/aws-s3-web/src/components/roadmap/roadmap-node.tsx` — accept a resolved node box instead of the old side-specific subtopic shape.
- `src/aws-s3-web/src/components/roadmap/roadmap-node.test.tsx` — update the fixture and preserve interaction/accessibility assertions.
- `src/aws-s3-web/src/components/roadmap/roadmap-shell.test.tsx` — assert groups, annotations, connector kinds, complete node coverage, and retained panel behavior.
- `src/aws-s3-web/src/app/roadmap/roadmap.css` — restyle the canvas as a compact poster graph and add stage/group/root states without changing the terminal theme.
- `src/aws-s3-web/e2e/roadmap.spec.ts` — update flowchart selectors and add narrow-viewport pan and geometry-stability checks.

### Keep unchanged unless a failing test proves otherwise

- `src/aws-s3-web/src/data/roadmap.ts`
- `src/aws-s3-web/src/types/roadmap.ts`
- `src/aws-s3-web/src/components/roadmap/roadmap-detail-panel.tsx`
- `src/aws-s3-web/src/components/roadmap/roadmap-hero.tsx`
- `src/aws-s3-web/src/components/roadmap/roadmap-legend.tsx`
- `src/aws-s3-web/src/hooks/use-fit-scale.ts`

---

### Task 1: Define and validate the authored graph contract

**Files:**

- Create: `src/aws-s3-web/src/lib/roadmap/blueprint.ts`
- Create: `src/aws-s3-web/src/lib/roadmap/blueprint.test.ts`

**Interfaces:**

- Consumes: `readonly RoadmapStage[]` from `@/types/roadmap`.
- Produces: `GraphBlueprint`, `ClusterBlueprint`, `ResolvedRoadmapLayout`, `compileRoadmapBlueprint(blueprint, stages)`, and `validateRoadmapLayout(layout, stages)`.

- [ ] **Step 1: Write failing tests for contract compilation and validation**

Create `blueprint.test.ts` with these concrete fixtures and assertions:

```ts
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
          { id: "processes", title: "Processes", importance: "core", note: "Signals.", myLevel: "production" },
          { id: "permissions", title: "Permissions", importance: "core", note: "Access.", myLevel: "working" },
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
      subtopics: { x: 800, y: 210, columns: 1, columnWidth: 220, rowHeight: 44, columnGap: 12, rowGap: 10 },
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
      expect.objectContaining({ id: "linux-tools", label: "Linux building blocks", memberIds: ["processes", "permissions"] }),
    ]);
  });

  it("places a two-column grid in row-major order", () => {
    const twoColumn = structuredClone(valid);
    twoColumn.clusters[0].subtopics.columns = 2;
    const layout = compileRoadmapBlueprint(twoColumn, stages);
    expect(layout.subtopics.map(({ x, y }) => [x, y])).toEqual([[800, 210], [1032, 210]]);
  });
});

describe("validateRoadmapLayout", () => {
  it("accepts a complete in-bounds layout", () => {
    expect(validateRoadmapLayout(compileRoadmapBlueprint(valid, stages), stages)).toEqual([]);
  });

  it.each([
    ["duplicate placement", (layout: ReturnType<typeof compileRoadmapBlueprint>) => layout.topics.push(layout.topics[0]), "duplicate node id: linux"],
    ["missing topic", (layout: ReturnType<typeof compileRoadmapBlueprint>) => layout.topics.splice(0), "missing topic placement: linux"],
    ["missing subtopic", (layout: ReturnType<typeof compileRoadmapBlueprint>) => layout.subtopics.splice(0), "missing subtopic placement: processes"],
    ["out of bounds", (layout: ReturnType<typeof compileRoadmapBlueprint>) => { layout.subtopics[0].x = 1190; }, "node outside canvas: processes"],
    ["non-positive dimensions", (layout: ReturnType<typeof compileRoadmapBlueprint>) => { layout.topics[0].width = 0; }, "invalid node dimensions: linux"],
    ["unknown group member", (layout: ReturnType<typeof compileRoadmapBlueprint>) => { layout.groups[0].memberIds.push("missing"); }, "unknown group member: missing"],
    ["member outside group", (layout: ReturnType<typeof compileRoadmapBlueprint>) => { layout.groups[0].width = 1; }, "group member outside bounds: processes"],
    ["unknown connector endpoint", (layout: ReturnType<typeof compileRoadmapBlueprint>) => { layout.connectors[0].to.nodeId = "missing"; }, "unknown connector target: missing"],
  ])("reports %s", (_name, mutate, expected) => {
    const layout = compileRoadmapBlueprint(valid, stages);
    mutate(layout);
    expect(validateRoadmapLayout(layout, stages)).toContain(expected);
  });
});
```

- [ ] **Step 2: Run the tests and verify the contract is missing**

Run:

```bash
cd src/aws-s3-web
pnpm test -- src/lib/roadmap/blueprint.test.ts
```

Expected: FAIL because `./blueprint` does not exist.

- [ ] **Step 3: Implement the geometry types and compiler**

Create `blueprint.ts` with these public types and signatures:

```ts
import type { RoadmapStage, RoadmapSubtopic, RoadmapTopic } from "@/types/roadmap";

export type LayoutBox = { x: number; y: number; width: number; height: number };
export type AnchorSide = "top" | "right" | "bottom" | "left";
export type ConnectorRoute = "curve" | "orthogonal";

export type ClusterBlueprint = {
  stageId: string;
  topicId: string;
  topic: LayoutBox;
  subtopics: {
    x: number;
    y: number;
    columns: 1 | 2;
    columnWidth: number;
    rowHeight: number;
    columnGap: number;
    rowGap: number;
  };
  frame?: { id: string; label: string; padding: number };
  route: ConnectorRoute;
};

export type GraphBlueprint = {
  width: number;
  height: number;
  root: LayoutBox;
  legend: LayoutBox;
  stages: readonly (LayoutBox & { stageId: string })[];
  clusters: ClusterBlueprint[];
};

export type ResolvedTopic = LayoutBox & { topic: RoadmapTopic; stageId: string };
export type ResolvedSubtopic = LayoutBox & {
  subtopic: RoadmapSubtopic;
  topicId: string;
  stageId: string;
};
export type ResolvedGroup = LayoutBox & {
  id: string;
  label: string;
  memberIds: string[];
};
export type ConnectorEndpoint = { nodeId: string; side: AnchorSide };
export type ConnectorDefinition = {
  id: string;
  kind: "primary" | "branch" | "alternative";
  route: ConnectorRoute;
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
};
export type ResolvedConnector = ConnectorDefinition & { d: string };
export type ResolvedStage = LayoutBox & { stage: RoadmapStage };
export type ResolvedRoadmapLayout = {
  width: number;
  height: number;
  root: LayoutBox;
  legend: LayoutBox;
  stages: ResolvedStage[];
  groups: ResolvedGroup[];
  topics: ResolvedTopic[];
  subtopics: ResolvedSubtopic[];
  connectors: ResolvedConnector[];
};

export function compileRoadmapBlueprint(
  blueprint: GraphBlueprint,
  stages: readonly RoadmapStage[],
): ResolvedRoadmapLayout;

export function validateRoadmapLayout(
  layout: ResolvedRoadmapLayout,
  stages: readonly RoadmapStage[],
): string[];
```

Implementation rules:

- Resolve stages/topics by ID using maps built once at the top of the compiler.
- Expand each cluster's subtopics in their existing data order with `column = index % columns` and `row = Math.floor(index / columns)`.
- Generate one primary connector from the root (`roadmap-root`) to the first
  topic, then one from each topic to the next topic in blueprint order.
- Generate one connector from a topic to every subtopic; use kind `alternative`
  when the subtopic importance is `optional`, otherwise use kind `branch`.
- Primary connectors attach bottom-to-top. Branch/alternative connectors attach
  right-to-left when the grid is to the topic's right and left-to-right when it
  is to the topic's left. The anchor helper is added in Task 2.
- A cluster's `route` controls its incoming primary connector and every branch
  or alternative connector generated for that cluster.
- Compute an optional frame from the subtopic grid's actual bounds, its
  configured `padding`, and a fixed 24px label band above the grid; store every
  generated subtopic ID in `memberIds`.
- Throw `new Error("Invalid roadmap blueprint:\n" + errors.join("\n"))` from the compiler when blueprint references cannot be resolved.
- Return all other invariant problems from `validateRoadmapLayout` as stable lowercase strings matching the tests.
- Until Task 2 installs the path builder, initialize each resolved connector
  with `d: ""`; this keeps the contract complete and type checking green.

- [ ] **Step 4: Run focused tests and type checking**

Run:

```bash
cd src/aws-s3-web
pnpm test -- src/lib/roadmap/blueprint.test.ts
pnpm typecheck
```

Expected: both commands pass. The existing `layout.ts` and renderer still use the old algorithm during this task, so the repository remains independently green.

- [ ] **Step 5: Commit the graph contract**

```bash
git add src/aws-s3-web/src/lib/roadmap/blueprint.ts src/aws-s3-web/src/lib/roadmap/blueprint.test.ts
git commit -m "refactor(roadmap): define authored graph blueprint"
```

---

### Task 2: Generate curved and rounded connector paths

**Files:**

- Create: `src/aws-s3-web/src/lib/roadmap/connector-path.ts`
- Create: `src/aws-s3-web/src/lib/roadmap/connector-path.test.ts`
- Modify: `src/aws-s3-web/src/lib/roadmap/blueprint.ts`

**Interfaces:**

- Consumes: `LayoutBox`, `AnchorSide`, `ConnectorRoute`, and `ConnectorDefinition` from `blueprint.ts`.
- Produces: `anchorPoint(box, side)` and `buildConnectorPath(connector, boxesById)`.

- [ ] **Step 1: Write exact failing path tests**

```ts
import { describe, expect, it } from "vitest";

import { anchorPoint, buildConnectorPath } from "./connector-path";
import type { ConnectorDefinition } from "./blueprint";

const boxes = new Map([
  ["a", { x: 0, y: 0, width: 100, height: 50 }],
  ["b", { x: 300, y: 100, width: 100, height: 50 }],
  ["c", { x: 50, y: 300, width: 100, height: 50 }],
]);

const connector = (route: ConnectorDefinition["route"]): ConnectorDefinition => ({
  id: `a-b-${route}`,
  kind: "primary",
  route,
  from: { nodeId: "a", side: "right" },
  to: { nodeId: "b", side: "left" },
});

describe("anchorPoint", () => {
  it("returns the center of each requested edge", () => {
    const box = boxes.get("a")!;
    expect(anchorPoint(box, "top")).toEqual({ x: 50, y: 0 });
    expect(anchorPoint(box, "right")).toEqual({ x: 100, y: 25 });
    expect(anchorPoint(box, "bottom")).toEqual({ x: 50, y: 50 });
    expect(anchorPoint(box, "left")).toEqual({ x: 0, y: 25 });
  });
});

describe("buildConnectorPath", () => {
  it("builds a horizontal cubic curve", () => {
    expect(buildConnectorPath(connector("curve"), boxes)).toBe("M 100 25 C 200 25 200 125 300 125");
  });

  it("orients cubic controls vertically for bottom-to-top routes", () => {
    const vertical: ConnectorDefinition = {
      id: "a-c-curve",
      kind: "primary",
      route: "curve",
      from: { nodeId: "a", side: "bottom" },
      to: { nodeId: "c", side: "top" },
    };
    expect(buildConnectorPath(vertical, boxes)).toBe("M 50 50 C 50 175 100 175 100 300");
  });

  it("builds a rounded orthogonal route", () => {
    const path = buildConnectorPath(connector("orthogonal"), boxes);
    expect(path).toBe("M 100 25 L 184 25 Q 200 25 200 41 L 200 109 Q 200 125 216 125 L 300 125");
  });

  it("throws when an endpoint is not placed", () => {
    const invalid = connector("curve");
    invalid.to.nodeId = "missing";
    expect(() => buildConnectorPath(invalid, boxes)).toThrow("Missing connector box: missing");
  });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

```bash
cd src/aws-s3-web
pnpm test -- src/lib/roadmap/connector-path.test.ts
```

Expected: FAIL because `connector-path.ts` does not exist.

- [ ] **Step 3: Implement anchor and routing helpers**

Use a 16px rounded-corner radius and round every generated number to two decimal places. Horizontal connections use a midpoint x for cubic controls and horizontal–vertical–horizontal orthogonal routes. Connections starting or ending on a top/bottom edge use midpoint y controls and vertical–horizontal–vertical orthogonal routes.

```ts
import type {
  AnchorSide,
  ConnectorDefinition,
  LayoutBox,
} from "./blueprint";

export type Point = { x: number; y: number };

export function anchorPoint(box: LayoutBox, side: AnchorSide): Point {
  if (side === "top") return { x: box.x + box.width / 2, y: box.y };
  if (side === "right") return { x: box.x + box.width, y: box.y + box.height / 2 };
  if (side === "bottom") return { x: box.x + box.width / 2, y: box.y + box.height };
  return { x: box.x, y: box.y + box.height / 2 };
}

export function buildConnectorPath(
  connector: ConnectorDefinition,
  boxesById: ReadonlyMap<string, LayoutBox>,
): string;
```

Do not embed raw path strings in `roadmap-blueprint.ts`; every path must be derived through this function.

- [ ] **Step 4: Replace provisional connector paths with generated `d` strings**

At the end of `compileRoadmapBlueprint`, create one `Map<string, LayoutBox>` containing the root (`"roadmap-root"`), topics, and subtopics, then replace each provisional empty `d` with `buildConnectorPath(connector, boxesById)`.

Update the Task 1 fixtures so expected connectors include non-empty `d` strings.

- [ ] **Step 5: Run the path and blueprint tests**

```bash
cd src/aws-s3-web
pnpm test -- src/lib/roadmap/connector-path.test.ts src/lib/roadmap/blueprint.test.ts
```

Expected: both files pass.

- [ ] **Step 6: Commit connector routing**

```bash
git add src/aws-s3-web/src/lib/roadmap/connector-path.ts src/aws-s3-web/src/lib/roadmap/connector-path.test.ts src/aws-s3-web/src/lib/roadmap/blueprint.ts src/aws-s3-web/src/lib/roadmap/blueprint.test.ts
git commit -m "feat(roadmap): route authored graph connectors"
```

---

### Task 3: Author the complete DevOps 2026 poster blueprint

**Files:**

- Create: `src/aws-s3-web/src/lib/roadmap/roadmap-blueprint.ts`
- Modify: `src/aws-s3-web/src/lib/roadmap/blueprint.test.ts`

**Interfaces:**

- Consumes: `GraphBlueprint` and `ClusterBlueprint` from `blueprint.ts`.
- Produces: `roadmapBlueprint`, a 1440×7900 coordinate plane covering exactly 4 stages, 24 topics, and every subtopic.

- [ ] **Step 1: Add failing real-blueprint topology assertions**

Add these assertions to `blueprint.test.ts`, compiling the authored source directly so the existing renderer stays green until Task 4:

```ts
import { roadmapStages } from "@/data/roadmap";
import { allSubtopics, allTopics } from "./experience";
import { roadmapBlueprint } from "./roadmap-blueprint";

describe("roadmapBlueprint", () => {
  const layout = compileRoadmapBlueprint(roadmapBlueprint, roadmapStages);

  it("resolves all original content exactly once", () => {
    expect(layout.topics).toHaveLength(allTopics(roadmapStages).length);
    expect(layout.subtopics).toHaveLength(allSubtopics(roadmapStages).length);
    expect(new Set(layout.topics.map(({ topic }) => topic.id)).size).toBe(layout.topics.length);
    expect(new Set(layout.subtopics.map(({ subtopic }) => subtopic.id)).size).toBe(layout.subtopics.length);
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
    expect(layout.groups.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "programming-options",
      "cloud-platform",
      "kubernetes-building-blocks",
      "delivery-toolchain",
      "observability-signals",
      "ai-platform",
    ]));
    expect(new Set(layout.connectors.map(({ route }) => route)).toEqual(
      new Set(["curve", "orthogonal"]),
    );
  });

  it("keeps every node and group within the 1440 by 7900 canvas", () => {
    expect(layout.width).toBe(1440);
    expect(layout.height).toBe(7900);
    for (const box of [layout.root, layout.legend, ...layout.stages, ...layout.topics, ...layout.subtopics, ...layout.groups]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
    }
  });
});
```

- [ ] **Step 2: Run the real-layout test and verify the blueprint module is missing**

```bash
cd src/aws-s3-web
pnpm test -- src/lib/roadmap/blueprint.test.ts
```

Expected: FAIL because `roadmap-blueprint.ts` does not exist.

- [ ] **Step 3: Implement the complete cluster table**

Use constants `TOPIC = { width: 300, height: 52 }`, `SUBTOPIC = { width: 220, height: 44 }`, two columns, `12px` column gap, `10px` row gap, and `18px` frame padding. Author these exact topic anchors and branch sides in `roadmap-blueprint.ts`:

| Stage | Topic ID | x | y | Subtopic grid x | Route | Frame ID when present |
| --- | --- | ---: | ---: | ---: | --- | --- |
| foundations | programming | 570 | 220 | 930 | curve | programming-options |
| foundations | linux | 430 | 500 | 40 | orthogonal | linux-building-blocks |
| foundations | networking | 710 | 800 | 930 | curve | networking-primitives |
| foundations | git | 500 | 1100 | 40 | orthogonal | version-control-workflow |
| foundations | cloud-fundamentals | 650 | 1400 | 930 | curve | cloud-platform |
| modern-devops | containers | 430 | 1750 | 40 | curve | container-toolchain |
| modern-devops | kubernetes | 720 | 2050 | 930 | orthogonal | kubernetes-building-blocks |
| modern-devops | iac | 480 | 2370 | 40 | curve | infrastructure-as-code |
| modern-devops | cicd | 700 | 2690 | 930 | orthogonal | delivery-toolchain |
| modern-devops | gitops | 470 | 3010 | 40 | curve | gitops-reconciliation |
| modern-devops | observability | 690 | 3330 | 930 | orthogonal | observability-signals |
| modern-devops | devsecops | 520 | 3650 | 40 | curve | supply-chain-security |
| ai-layer | ai-assisted-engineering | 720 | 4100 | 930 | curve | ai-engineering-controls |
| ai-layer | llm-fundamentals | 480 | 4390 | 40 | orthogonal | llm-foundations |
| ai-layer | mcp | 740 | 4680 | 930 | curve | mcp-tooling |
| ai-layer | aiops | 470 | 4970 | 40 | orthogonal | aiops-operations |
| ai-layer | llmops | 720 | 5260 | 930 | curve | ai-platform |
| ai-layer | ai-security | 500 | 5550 | 40 | orthogonal | ai-security-governance |
| ai-layer | ai-limits | 700 | 5840 | 930 | curve | — |
| senior-impact | platform-engineering | 470 | 6240 | 40 | curve | platform-product |
| senior-impact | sre | 720 | 6540 | 930 | orthogonal | reliability-practice |
| senior-impact | finops | 470 | 6840 | 40 | curve | cost-engineering |
| senior-impact | architecture | 720 | 7140 | 930 | orthogonal | resilient-architecture |
| senior-impact | leadership | 570 | 7440 | 40 | curve | engineering-leadership |

Use subtopic grid `y = topic.y - 52`. Each cluster consumes the topic's existing subtopics in source order. Set `columns: 2` for every cluster except `ai-limits`, which uses one column at `x = 1020` to emphasize the boundary/guardrail sequence.

Set root to `{ x: 570, y: 40, width: 300, height: 68 }`, legend to `{ x: 40, y: 24, width: 340, height: 138 }`, and stage annotations to:

```ts
[
  { stageId: "foundations", x: 40, y: 190, width: 240, height: 42 },
  { stageId: "modern-devops", x: 1160, y: 1710, width: 240, height: 42 },
  { stageId: "ai-layer", x: 40, y: 4060, width: 240, height: 42 },
  { stageId: "senior-impact", x: 1160, y: 6200, width: 240, height: 42 },
]
```

Use these exact frame labels:

```ts
const FRAME_LABELS = {
  "programming-options": "Languages & automation",
  "linux-building-blocks": "Linux building blocks",
  "networking-primitives": "Network protocols & diagnostics",
  "version-control-workflow": "Version control workflow",
  "cloud-platform": "Cloud platform & primitives",
  "container-toolchain": "Container toolchain",
  "kubernetes-building-blocks": "Kubernetes building blocks",
  "infrastructure-as-code": "Provisioning & configuration",
  "delivery-toolchain": "Delivery engines & practices",
  "gitops-reconciliation": "GitOps reconciliation",
  "observability-signals": "Signals & observability tooling",
  "supply-chain-security": "Software supply-chain security",
  "ai-engineering-controls": "AI engineering & review controls",
  "llm-foundations": "LLM foundations for operations",
  "mcp-tooling": "MCP tools & permissions",
  "aiops-operations": "AIOps signals & guardrails",
  "ai-platform": "Model platform & serving",
  "ai-security-governance": "AI security & governance",
  "platform-product": "Platform as a product",
  "reliability-practice": "Reliability engineering practice",
  "cost-engineering": "Cloud cost engineering",
  "resilient-architecture": "Resilient architecture",
  "engineering-leadership": "Technical leadership",
} as const;
```

The compiler calculates the subtopic grid and frame bounds. Do not place a label by reading layout text width at runtime.

- [ ] **Step 4: Validate the real blueprint inside its own test**

Add to `blueprint.test.ts`:

```ts
import { roadmapStages } from "@/data/roadmap";
import { roadmapBlueprint } from "./roadmap-blueprint";

it("validates the complete authored 2026 roadmap", () => {
  const layout = compileRoadmapBlueprint(roadmapBlueprint, roadmapStages);
  expect(validateRoadmapLayout(layout, roadmapStages)).toEqual([]);
});
```

- [ ] **Step 5: Run all pure roadmap tests**

```bash
cd src/aws-s3-web
pnpm test -- src/lib/roadmap/blueprint.test.ts src/lib/roadmap/connector-path.test.ts src/lib/roadmap/layout.test.ts src/lib/roadmap/experience.test.ts src/data/roadmap.test.ts
pnpm typecheck
```

Expected: all tests and type checking pass. The new blueprint reports zero validation errors, while the still-active legacy layout tests remain green until the renderer switch in Task 4.

- [ ] **Step 6: Commit the complete blueprint**

```bash
git add src/aws-s3-web/src/lib/roadmap/roadmap-blueprint.ts src/aws-s3-web/src/lib/roadmap/blueprint.test.ts
git commit -m "feat(roadmap): author dense 2026 graph topology"
```

---

### Task 4: Render the layered graph without losing accessibility

**Files:**

- Modify: `src/aws-s3-web/src/lib/roadmap/layout.ts`
- Modify: `src/aws-s3-web/src/lib/roadmap/layout.test.ts`
- Modify: `src/aws-s3-web/src/components/roadmap/roadmap-canvas.tsx`
- Modify: `src/aws-s3-web/src/components/roadmap/roadmap-node.tsx`
- Modify: `src/aws-s3-web/src/components/roadmap/roadmap-node.test.tsx`
- Modify: `src/aws-s3-web/src/components/roadmap/roadmap-shell.test.tsx`

**Interfaces:**

- Consumes: `ResolvedRoadmapLayout`, `ResolvedSubtopic`, and connector `d` strings from Tasks 1–3.
- Produces: the public `buildRoadmapLayout(stages)` adapter plus `.rm-root`, `.rm-stage-annotation`, `.rm-group`, `.rm-wire[data-kind]`, `.rm-topic`, and `.rm-subtopic` DOM contracts used by CSS and Playwright.

- [ ] **Step 1: Update layout and component tests to describe the new contract**

Replace `layout.test.ts` with the four real-layout assertions from Task 3: exact content coverage, four ordered stages and multi-directional x values, at least ten named frames and both route types, and all boxes inside the 1440×7900 canvas. Import `buildRoadmapLayout` from `./layout`; this test must exercise the public adapter rather than compiling the blueprint directly.

In `roadmap-node.test.tsx`, replace `LayoutSubtopic` with `ResolvedSubtopic` and remove the obsolete `side` field from the fixture. Keep all seven existing assertions unchanged otherwise.

In `roadmap-shell.test.tsx`, replace the divider/spine assertions with:

```ts
it("renders the authored root, annotations, groups, and every content node", () => {
  render(<RoadmapShell />);

  expect(document.querySelector(".rm-root")).toHaveTextContent("DevOps 2026");
  expect(document.querySelectorAll(".rm-stage-annotation")).toHaveLength(roadmapStages.length);
  expect(document.querySelectorAll(".rm-group").length).toBeGreaterThanOrEqual(10);
  expect(document.querySelectorAll(".rm-topic")).toHaveLength(topics.length);
  expect(document.querySelectorAll(".rm-subtopic")).toHaveLength(subtopics.length);
  expect(document.querySelectorAll('.rm-wire[data-kind="primary"]')).toHaveLength(topics.length);
  expect(
    document.querySelectorAll('.rm-wire[data-kind="branch"], .rm-wire[data-kind="alternative"]'),
  ).toHaveLength(subtopics.length);
});

it("keeps decorative layers out of the accessibility tree", () => {
  const { container } = render(<RoadmapShell />);
  expect(container.querySelector(".rm-wires")).toHaveAttribute("aria-hidden", "true");
  expect(container.querySelector(".rm-groups-layer")).toHaveAttribute("aria-hidden", "true");
});
```

Keep all existing experience and detail-panel tests.

- [ ] **Step 2: Run component tests and confirm they fail against the old renderer**

```bash
cd src/aws-s3-web
pnpm test -- src/lib/roadmap/layout.test.ts src/components/roadmap/roadmap-node.test.tsx src/components/roadmap/roadmap-shell.test.tsx
```

Expected: FAIL because the public adapter and components still expose the old spine layout.

- [ ] **Step 3: Switch the public layout adapter**

Replace `layout.ts` with:

```ts
import { compileRoadmapBlueprint } from "./blueprint";
import { roadmapBlueprint } from "./roadmap-blueprint";
import type { RoadmapStage } from "@/types/roadmap";

export * from "./blueprint";

export function buildRoadmapLayout(stages: readonly RoadmapStage[]) {
  return compileRoadmapBlueprint(roadmapBlueprint, stages);
}
```

- [ ] **Step 4: Generalize `RoadmapNodeCard` to the resolved node type**

Use `ResolvedSubtopic` and keep the same markup contract:

```ts
import type { ResolvedSubtopic } from "@/lib/roadmap/blueprint";

export type RoadmapNodeCardProps = {
  subtopic: ResolvedSubtopic;
  showExperience: boolean;
  onOpen: (subtopicId: string) => void;
};
```

Preserve `data-importance`, conditional `data-level`, tooltip text, hidden accessible experience text, and the `onOpen(node.id)` callback.

- [ ] **Step 5: Render all graph layers in `RoadmapCanvas`**

Replace the old title, stage labels, and `layout.edges` rendering with:

```tsx
<svg className="rm-groups-layer" width={layout.width} height={layout.height} aria-hidden="true">
  {layout.groups.map((group) => (
    <g key={group.id} className="rm-group" data-group={group.id}>
      <rect x={group.x} y={group.y} width={group.width} height={group.height} rx="8" />
      <text x={group.x + 14} y={group.y + 22}>{group.label}</text>
    </g>
  ))}
</svg>

<svg className="rm-wires" width={layout.width} height={layout.height} aria-hidden="true" focusable="false">
  {layout.connectors.map((connector) => (
    <path key={connector.id} className="rm-wire" data-kind={connector.kind} d={connector.d} />
  ))}
</svg>

<p className="rm-root" style={{ left: layout.root.x, top: layout.root.y, width: layout.root.width, height: layout.root.height }}>
  <span className="code-comment">{"// career path"}</span>
  <span>DevOps 2026</span>
</p>

{layout.stages.map((entry) => (
  <button
    key={entry.stage.id}
    type="button"
    className="rm-stage-annotation"
    data-accent={entry.stage.accent}
    style={{ left: entry.x, top: entry.y, width: entry.width, height: entry.height }}
    onClick={() => onOpenStage(entry.stage.id)}
  >
    <span>{entry.stage.kicker}</span>
    {entry.stage.label}
  </button>
))}
```

Render topics and subtopics after these layers so every button is clickable. Keep `RoadmapLegend`, terminal titlebar, `useFitScale`, scaled `.rm-scroller`, and the narrow-screen hint.

- [ ] **Step 6: Run layout, component, and type checks**

```bash
cd src/aws-s3-web
pnpm test -- src/lib/roadmap/layout.test.ts src/components/roadmap/roadmap-node.test.tsx src/components/roadmap/roadmap-shell.test.tsx src/components/roadmap/roadmap-detail-panel.test.tsx
pnpm typecheck
```

Expected: all commands pass with no references to `stageLabels`, `edges`, or `side`.

- [ ] **Step 7: Commit the adapter and accessible rendering**

```bash
git add src/aws-s3-web/src/lib/roadmap/layout.ts src/aws-s3-web/src/lib/roadmap/layout.test.ts src/aws-s3-web/src/components/roadmap/roadmap-canvas.tsx src/aws-s3-web/src/components/roadmap/roadmap-node.tsx src/aws-s3-web/src/components/roadmap/roadmap-node.test.tsx src/aws-s3-web/src/components/roadmap/roadmap-shell.test.tsx
git commit -m "feat(roadmap): render authored poster graph"
```

---

### Task 5: Apply compact terminal poster styling and responsive panning

**Files:**

- Modify: `src/aws-s3-web/src/app/roadmap/roadmap.css`
- Test: `src/aws-s3-web/e2e/roadmap.spec.ts`

**Interfaces:**

- Consumes: Task 4 DOM classes and existing `--rm-*`/portfolio theme tokens.
- Produces: stable desktop scaling, readable mobile minimum scale, group/root/stage styling, and distinct primary/branch connectors.

- [ ] **Step 1: Add failing end-to-end expectations for the new visual contract**

Update the first E2E test with these exact assertions for `.rm-stage-annotation`, `.rm-group`, `.rm-root`, primary connectors, and the combined branch/alternative connector count:

```ts
await expect(page.locator(".rm-root")).toContainText("DevOps 2026");
await expect(page.locator(".rm-stage-annotation")).toHaveCount(4);
expect(await page.locator(".rm-group").count()).toBeGreaterThanOrEqual(10);
await expect(page.locator(".rm-topic")).toHaveCount(24);
await expect(page.locator('.rm-wire[data-kind="primary"]')).toHaveCount(24);
await expect(
  page.locator('.rm-wire[data-kind="branch"], .rm-wire[data-kind="alternative"]'),
).toHaveCount(159);
```

Add the geometry-stability test:

```ts
test("keeps the authored topology stable when experience is toggled", async ({ page }) => {
  await page.goto("/roadmap");

  const before = await page.locator(".rm-topic").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.id,
      left: (node as HTMLElement).style.left,
      top: (node as HTMLElement).style.top,
    })),
  );

  await page.getByRole("button", { name: /my experience/i }).click();

  const after = await page.locator(".rm-topic").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.id,
      left: (node as HTMLElement).style.left,
      top: (node as HTMLElement).style.top,
    })),
  );

  expect(after).toEqual(before);
});
```

Replace the old mobile test with:

```ts
test("pans the readable poster on mobile without overflowing the document", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/roadmap");

  await expect(page.locator(".rm-scroll-hint")).toBeVisible();

  const metrics = await page.locator(".rm-viewport").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.pageOverflow).toBe(false);
});
```

- [ ] **Step 2: Run the focused E2E file and verify style-contract failures**

```bash
cd src/aws-s3-web
pnpm exec playwright test e2e/roadmap.spec.ts
```

Expected: the new selector/style assertions fail before CSS is updated; existing panel interaction remains green.

- [ ] **Step 3: Replace obsolete spine styles with poster layers**

In `roadmap.css`:

- Delete `.rm-canvas-title`, `.rm-stage-label`, and `data-kind="spine"` styling.
- Position `.rm-groups-layer` and `.rm-wires` absolutely with `inset: 0`, `overflow: visible`, and `pointer-events: none`.
- Style `.rm-group rect` with `fill: var(--rm-legend-bg)`, `stroke: var(--rm-border)`, and `stroke-width: 1.25`.
- Style `.rm-group text` with `fill: var(--rm-muted)` and `font: 600 12px "Geist Mono", ui-monospace, monospace`.
- Style `.rm-wire[data-kind="primary"]` with `stroke: var(--accent)`, `stroke-width: 3`, and full opacity.
- Style branch connectors with `stroke: var(--rm-wire)`, `stroke-width: 2`, and `opacity: 0.68`; use a dashed stroke only for `data-kind="alternative"`.
- Style `.rm-root` as a centered 68px terminal-accent box with a two-line comment/title treatment.
- Style `.rm-stage-annotation` as a compact rectangular terminal label, not a pill, with its kicker in muted 10px mono text.
- Reduce topic and subtopic radii to `5px`, keep the existing importance colors,
  and clamp `.rm-box-label` to two wrapped lines with `display: -webkit-box`,
  `-webkit-box-orient: vertical`, `-webkit-line-clamp: 2`, `overflow: hidden`,
  `white-space: normal`, and `overflow-wrap: anywhere`.
- Do not animate connector drawing; the complete path must be visible on first
  paint in both normal and reduced-motion modes.

- [ ] **Step 4: Enforce the responsive behavior**

Keep `.rm-viewport { overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; }`. Keep the current `useFitScale` minimum of `0.46`; with the new 1440px plane, mobile produces a 662px-wide scroller and therefore meaningful horizontal pan while the document itself remains 390px wide.

At `max-width: 720px`, keep the hint visible and use `padding: 16px 0`. Add visible focus outlines that are not clipped by the SVG layers:

```css
.rm-box:focus-visible,
.rm-stage-annotation:focus-visible {
  outline: 3px solid var(--accent-bright);
  outline-offset: 3px;
  z-index: 3;
}
```

- [ ] **Step 5: Run E2E, component tests, and light/dark checks**

```bash
cd src/aws-s3-web
pnpm exec playwright test e2e/roadmap.spec.ts
pnpm test -- src/components/roadmap/roadmap-shell.test.tsx
```

Expected: all tests pass. The existing luma assertions must be updated from `.rm-stage-label` to `.rm-stage-annotation`; do not weaken their dark/light thresholds.

- [ ] **Step 6: Commit terminal poster styling**

```bash
git add src/aws-s3-web/src/app/roadmap/roadmap.css src/aws-s3-web/e2e/roadmap.spec.ts
git commit -m "style(roadmap): apply dense terminal poster layout"
```

---

### Task 6: Full regression and visual verification

**Files:**

- Modify only files already listed when verification exposes a concrete defect.
- Do not modify roadmap content to make layout tests easier.

**Interfaces:**

- Consumes: the complete implementation from Tasks 1–5.
- Produces: passing quality gates and visual evidence at desktop/mobile in both themes.

- [ ] **Step 1: Run formatting-sensitive and static checks**

```bash
cd src/aws-s3-web
git diff --check
pnpm lint
pnpm typecheck
```

Expected: all commands exit 0.

- [ ] **Step 2: Run the complete unit/component suite**

```bash
cd src/aws-s3-web
pnpm test
```

Expected: all Vitest files pass, including data, experience, blueprint, connector, shell, node, and detail-panel coverage.

- [ ] **Step 3: Run the focused browser suite**

```bash
cd src/aws-s3-web
pnpm exec playwright test e2e/roadmap.spec.ts e2e/portfolio.spec.ts
```

Expected: roadmap behavior passes and the portfolio regression suite confirms the route-scoped redesign did not affect the homepage.

- [ ] **Step 4: Build the static export**

```bash
cd src/aws-s3-web
pnpm build
```

Expected: Next.js exits 0 and writes `out/roadmap.html` without hydration, metadata, or export errors.

- [ ] **Step 5: Perform visual checks at four viewports**

Serve the static export and inspect `/roadmap.html` at:

- 1440×900 dark;
- 1440×900 light;
- 768×1024 light;
- 390×844 dark.

For each viewport verify:

- the graph reads as a dense, multi-directional poster rather than a central alternating spine;
- the four stages are identifiable;
- framed groups do not clip labels or nodes;
- connectors terminate at node edges and do not cross labels;
- all long labels wrap within two lines;
- the mobile viewport pans horizontally while the document does not;
- experience badges and focus outlines remain visible;
- opening and closing the panel does not move the graph.

If a defect is found, first add or tighten the smallest relevant automated assertion, run it to see the failure, then patch the responsible geometry/render/style file and rerun the focused test.

- [ ] **Step 6: Commit only verification-driven corrections**

If Step 5 required changes:

```bash
git add src/aws-s3-web/src/lib/roadmap src/aws-s3-web/src/components/roadmap src/aws-s3-web/src/app/roadmap/roadmap.css src/aws-s3-web/e2e/roadmap.spec.ts
git commit -m "fix(roadmap): correct poster layout regressions"
```

If no files changed, skip this commit.

- [ ] **Step 7: Review final scope and history**

```bash
git status --short
git diff --stat feat/roadmap-subdomain...HEAD
git log --oneline --decorate -8
```

Expected: only roadmap implementation/tests and the approved design/plan docs are in scope; `.gitignore` is not staged; the task commits are small and ordered by dependency.
