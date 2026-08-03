# DevOps Roadmap Overlap Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every block intersection and prevent roadmap connector paths from crossing unrelated blocks while preserving the compact two-column terminal poster.

**Architecture:** Strengthen the pure layout validator with spatial collision checks, extend connector definitions with generated waypoint lanes, and reposition topic anchors into a collision-free central corridor. Expose connector endpoints to Playwright for rendered SVG sampling and make HTML node surfaces opaque over the decorative wire layer.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, SVG, route-scoped CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Execute directly on `feat/roadmap-subdomain`; do not create a worktree.
- Preserve the 1440×7900 coordinate plane and the compact two-column groups.
- Preserve all original roadmap content, ordering, importance tiers, resources, and experience annotations.
- Preserve the terminal theme, light/dark modes, hero, detail panel, keyboard behavior, and mobile panning.
- Keep at least 48px horizontal clearance between every topic and its framed branch group.
- Keep all topic and subtopic rectangles mutually disjoint.
- Keep group frames disjoint from every non-member node.
- Generate all connector paths through `connector-path.ts`; store no raw SVG path strings in the authored blueprint.
- Keep interactive nodes as HTML buttons and decorative SVG layers `aria-hidden="true"`.
- Add no runtime dependency and make no infrastructure, API, authentication, or persistence change.
- Before every commit, run `git diff --check`, stage only the paths named by the step, and confirm `.gitignore` is absent from `git diff --cached --name-only`.
- Commit every file-changing step with the exact focused commit shown below; do not squash during implementation.

---

## File Structure

### Modify

- `src/aws-s3-web/src/lib/roadmap/blueprint.ts` — add collision validation and compile generated far-column routing lanes.
- `src/aws-s3-web/src/lib/roadmap/blueprint.test.ts` — cover node/group intersections, topic-group clearance, and authored far-column routing.
- `src/aws-s3-web/src/lib/roadmap/connector-path.ts` — generate rounded paths through explicit orthogonal waypoints.
- `src/aws-s3-web/src/lib/roadmap/connector-path.test.ts` — specify exact rounded waypoint output.
- `src/aws-s3-web/src/lib/roadmap/roadmap-blueprint.ts` — move topic anchors into safe left/right central lanes.
- `src/aws-s3-web/src/components/roadmap/roadmap-canvas.tsx` — expose connector source and target IDs for rendered geometry tests.
- `src/aws-s3-web/src/components/roadmap/roadmap-shell.test.tsx` — preserve decorative-layer and interaction coverage while asserting connector metadata.
- `src/aws-s3-web/src/app/roadmap/roadmap.css` — composite importance tints over an opaque roadmap background.
- `src/aws-s3-web/e2e/roadmap.spec.ts` — sample SVG paths and verify opaque node surfaces.

### Keep unchanged unless a failing regression proves otherwise

- `src/aws-s3-web/src/data/roadmap.ts`
- `src/aws-s3-web/src/types/roadmap.ts`
- `src/aws-s3-web/src/components/roadmap/roadmap-node.tsx`
- `src/aws-s3-web/src/components/roadmap/roadmap-detail-panel.tsx`
- `src/aws-s3-web/src/hooks/use-fit-scale.ts`

---

### Task 1: Enforce spatial collision invariants

**Files:**

- Modify: `src/aws-s3-web/src/lib/roadmap/blueprint.test.ts`
- Modify: `src/aws-s3-web/src/lib/roadmap/blueprint.ts`

**Interfaces:**

- Consumes: `LayoutBox`, `ResolvedRoadmapLayout`, and resolved node/group arrays.
- Produces: `boxesIntersect(a, b)` internally and stable validator errors `overlapping nodes: <a> / <b>` and `group overlaps node: <group> / <node>`.

- [ ] **Step 1: Add failing validator tests for node and group intersections**

Add these cases to the existing `validateRoadmapLayout` table in `blueprint.test.ts`:

```ts
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
```

Commit the red contract:

```bash
git diff --check
git add src/aws-s3-web/src/lib/roadmap/blueprint.test.ts
git commit -m "test(roadmap): specify spatial collision invariants"
```

- [ ] **Step 2: Run the focused test and observe both missing errors**

Run:

```bash
cd src/aws-s3-web
pnpm exec vitest run src/lib/roadmap/blueprint.test.ts
```

Expected: FAIL because `validateRoadmapLayout` returns neither collision error.

- [ ] **Step 3: Implement strict rectangle intersection validation**

Add this helper beside `boxContains` in `blueprint.ts`:

```ts
function boxesIntersect(a: LayoutBox, b: LayoutBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
```

Track ordered node entries as they are added:

```ts
const nodeEntries: { id: string; box: LayoutBox }[] = [];

const addNode = (id: string, box: LayoutBox, placed: Set<string>) => {
  if (nodes.has(id)) errors.push(`duplicate node id: ${id}`);
  nodes.set(id, box);
  nodeEntries.push({ id, box });
  placed.add(id);
  if (!isValidBox(box)) errors.push(`invalid node dimensions: ${id}`);
  if (!isInBounds(box, layout)) errors.push(`node outside canvas: ${id}`);
};
```

After all nodes are added, compare every pair once:

```ts
for (let index = 0; index < nodeEntries.length; index += 1) {
  for (let otherIndex = index + 1; otherIndex < nodeEntries.length; otherIndex += 1) {
    const first = nodeEntries[index];
    const second = nodeEntries[otherIndex];
    if (boxesIntersect(first.box, second.box)) {
      errors.push(`overlapping nodes: ${first.id} / ${second.id}`);
    }
  }
}
```

Inside the group loop, after member containment checks, compare the group with every node whose ID is not in `memberIds`:

```ts
const members = new Set(group.memberIds);
for (const node of nodeEntries) {
  if (!members.has(node.id) && boxesIntersect(group, node.box)) {
    errors.push(`group overlaps node: ${group.id} / ${node.id}`);
  }
}
```

Commit the implementation:

```bash
git diff --check
git add src/aws-s3-web/src/lib/roadmap/blueprint.ts
git commit -m "feat(roadmap): validate spatial collisions"
```

- [ ] **Step 4: Run focused tests**

```bash
cd src/aws-s3-web
pnpm exec vitest run src/lib/roadmap/blueprint.test.ts
```

Expected: synthetic collision tests pass; the real authored-layout validation fails and names the currently intersecting topic/group pairs. That red real-layout failure is the evidence Task 3 will resolve.

---

### Task 2: Generate rounded paths through explicit routing lanes

**Files:**

- Modify: `src/aws-s3-web/src/lib/roadmap/blueprint.ts`
- Modify: `src/aws-s3-web/src/lib/roadmap/connector-path.ts`
- Modify: `src/aws-s3-web/src/lib/roadmap/connector-path.test.ts`

**Interfaces:**

- Produces: `ConnectorPoint`, optional `ConnectorDefinition.waypoints`, and waypoint-aware `buildConnectorPath(connector, boxesById)`.
- Waypoints are authored as coordinates, while the path builder remains the only module that emits SVG `d` strings.

- [ ] **Step 1: Write the failing exact waypoint-path test**

Add to `connector-path.test.ts`:

```ts
it("rounds every corner in an explicit orthogonal lane", () => {
  const routed: ConnectorDefinition = {
    ...connector("orthogonal"),
    id: "a-b-waypoints",
    waypoints: [
      { x: 180, y: 25 },
      { x: 180, y: 125 },
    ],
  };

  expect(buildConnectorPath(routed, boxes)).toBe(
    "M 100 25 L 164 25 Q 180 25 180 41 L 180 109 Q 180 125 196 125 L 300 125",
  );
});
```

Commit the red routing test:

```bash
git diff --check
git add src/aws-s3-web/src/lib/roadmap/connector-path.test.ts
git commit -m "test(roadmap): specify waypoint connector routing"
```

- [ ] **Step 2: Run the path test and observe the type/behavior failure**

```bash
cd src/aws-s3-web
pnpm exec vitest run src/lib/roadmap/connector-path.test.ts
```

Expected: FAIL because `ConnectorDefinition` has no `waypoints` contract and the builder ignores the requested lane.

- [ ] **Step 3: Add the waypoint contract**

In `blueprint.ts`, add:

```ts
export type ConnectorPoint = { x: number; y: number };

export type ConnectorDefinition = {
  id: string;
  kind: "primary" | "branch" | "alternative";
  route: ConnectorRoute;
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  waypoints?: readonly ConnectorPoint[];
};
```

Commit the type step:

```bash
git diff --check
git add src/aws-s3-web/src/lib/roadmap/blueprint.ts
git commit -m "feat(roadmap): define connector waypoints"
```

- [ ] **Step 4: Implement rounded polyline generation**

In `connector-path.ts`, import `ConnectorPoint` and add these helpers:

```ts
function segmentLength(from: ConnectorPoint, to: ConnectorPoint): number {
  if (from.x !== to.x && from.y !== to.y) {
    throw new Error("Connector waypoints must form orthogonal segments");
  }
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

function moveToward(
  from: ConnectorPoint,
  to: ConnectorPoint,
  distance: number,
): ConnectorPoint {
  const length = segmentLength(from, to);
  if (length === 0) return from;
  return {
    x: format(from.x + ((to.x - from.x) / length) * distance),
    y: format(from.y + ((to.y - from.y) / length) * distance),
  };
}

function roundedPolylinePath(points: readonly ConnectorPoint[]): string {
  const parts = [`M ${format(points[0].x)} ${format(points[0].y)}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const radius = Math.min(
      CORNER_RADIUS,
      segmentLength(previous, corner) / 2,
      segmentLength(corner, next) / 2,
    );
    const entry = moveToward(corner, previous, radius);
    const exit = moveToward(corner, next, radius);
    parts.push(
      `L ${entry.x} ${entry.y}`,
      `Q ${format(corner.x)} ${format(corner.y)} ${exit.x} ${exit.y}`,
    );
  }

  const end = points.at(-1)!;
  parts.push(`L ${format(end.x)} ${format(end.y)}`);
  return parts.join(" ");
}
```

Use the helper before the existing route switch:

```ts
if (connector.waypoints?.length) {
  return roundedPolylinePath([start, ...connector.waypoints, end]);
}
```

Commit the path builder:

```bash
git diff --check
git add src/aws-s3-web/src/lib/roadmap/connector-path.ts
git commit -m "feat(roadmap): route connectors through waypoints"
```

- [ ] **Step 5: Run connector and type checks**

```bash
cd src/aws-s3-web
pnpm exec vitest run src/lib/roadmap/connector-path.test.ts
pnpm typecheck
```

Expected: exact waypoint and existing curve/orthogonal tests pass; TypeScript exits 0.

---

### Task 3: Move topics into safe lanes and route far-column branches

**Files:**

- Modify: `src/aws-s3-web/src/lib/roadmap/blueprint.ts`
- Modify: `src/aws-s3-web/src/lib/roadmap/blueprint.test.ts`
- Modify: `src/aws-s3-web/src/lib/roadmap/roadmap-blueprint.ts`

**Interfaces:**

- Consumes: `ConnectorDefinition.waypoints` from Task 2 and compiler-generated group bounds.
- Produces: direct near-column connectors, outer-lane far-column connectors, and authored topic/group clearance of at least 48px.

- [ ] **Step 1: Add failing compiler and real-layout assertions**

Extend the two-column compiler test with four subtopics and assert near/far routing explicitly:

```ts
const twoColumnStages = structuredClone(stages);
twoColumnStages[0].topics[0].subtopics.push(
  { id: "packages", title: "Packages", importance: "core", note: "Install.", myLevel: "working" },
  { id: "services", title: "Services", importance: "core", note: "Run.", myLevel: "working" },
);
const twoColumn = structuredClone(valid);
twoColumn.clusters[0].subtopics.columns = 2;
const compiled = compileRoadmapBlueprint(twoColumn, twoColumnStages);
const branches = compiled.connectors.filter((connector) => connector.kind !== "primary");

expect(branches.filter((connector) => !connector.waypoints)).toHaveLength(2);
expect(branches.filter((connector) => connector.waypoints?.length === 4)).toHaveLength(2);
expect(
  branches
    .filter((connector) => connector.waypoints)
    .every((connector) => connector.to.side === "right" && connector.route === "orthogonal"),
).toBe(true);
```

Add this real-layout clearance assertion:

```ts
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
```

Assert every two-column cluster has one routed far-column connector per populated far-column node:

```ts
const routedBranches = layout.connectors.filter(
  (connector) => connector.kind !== "primary" && connector.waypoints?.length === 4,
);
expect(routedBranches.length).toBeGreaterThan(0);
expect(routedBranches.every((connector) => connector.route === "orthogonal")).toBe(true);
```

Commit the red authored-geometry contract:

```bash
git diff --check
git add src/aws-s3-web/src/lib/roadmap/blueprint.test.ts
git commit -m "test(roadmap): specify collision-free authored geometry"
```

- [ ] **Step 2: Run the blueprint test and confirm routing and clearance failures**

```bash
cd src/aws-s3-web
pnpm exec vitest run src/lib/roadmap/blueprint.test.ts
```

Expected: FAIL because far branches have no waypoints, existing topic anchors violate 48px clearance, and the strengthened validator reports intersections.

- [ ] **Step 3: Compile outer routing lanes for far-column nodes**

Refactor one cluster compilation pass into this order: resolve all subtopic boxes with their column index, calculate and append the optional group, then generate branch connectors.

For a two-column framed group:

```ts
const adjacentColumn = gridIsRightOfTopic ? 0 : cluster.subtopics.columns - 1;
const isFarColumn = cluster.subtopics.columns === 2 && column !== adjacentColumn;
```

Keep the existing direct connector for an adjacent-column node. For a far-column node, use `route: "orthogonal"`, enter the target from its outer edge, and add these four waypoints:

```ts
const topicCenterY = cluster.topic.y + cluster.topic.height / 2;
const targetCenterY = entry.y + entry.height / 2;
const innerLaneX = gridIsRightOfTopic ? group.x - 16 : group.x + group.width + 16;
const outerLaneX = gridIsRightOfTopic ? group.x + group.width + 16 : group.x - 16;
const topLaneY = group.y - 16;

waypoints: [
  { x: innerLaneX, y: topicCenterY },
  { x: innerLaneX, y: topLaneY },
  { x: outerLaneX, y: topLaneY },
  { x: outerLaneX, y: targetCenterY },
],
to: { nodeId: entry.subtopic.id, side: gridIsRightOfTopic ? "right" : "left" },
```

Commit the compiler change:

```bash
git diff --check
git add src/aws-s3-web/src/lib/roadmap/blueprint.ts
git commit -m "feat(roadmap): route far branches around groups"
```

- [ ] **Step 4: Move all topic anchors into collision-free central lanes**

Keep every existing `y`, grid `x`, route, frame ID, root, legend, and stage annotation. Replace only topic `x` values with this table:

| Topic | New x | Branch group side |
| --- | ---: | --- |
| programming | 540 | right |
| linux | 600 | left |
| networking | 520 | right |
| git | 580 | left |
| cloud-fundamentals | 550 | right |
| containers | 620 | left |
| kubernetes | 530 | right |
| iac | 590 | left |
| cicd | 560 | right |
| gitops | 610 | left |
| observability | 540 | right |
| devsecops | 580 | left |
| ai-assisted-engineering | 520 | right |
| llm-fundamentals | 600 | left |
| mcp | 550 | right |
| aiops | 620 | left |
| llmops | 530 | right |
| ai-security | 590 | left |
| ai-limits | 560 | right, one column |
| platform-engineering | 610 | left |
| sre | 520 | right |
| finops | 580 | left |
| architecture | 550 | right |
| leadership | 600 | left |

Commit the authored coordinate correction:

```bash
git diff --check
git add src/aws-s3-web/src/lib/roadmap/roadmap-blueprint.ts
git commit -m "fix(roadmap): separate topics from branch groups"
```

- [ ] **Step 5: Run pure layout and type checks**

```bash
cd src/aws-s3-web
pnpm exec vitest run src/lib/roadmap/blueprint.test.ts src/lib/roadmap/connector-path.test.ts src/lib/roadmap/layout.test.ts
pnpm typecheck
```

Expected: all focused tests pass, `validateRoadmapLayout` returns no errors for the complete roadmap, and TypeScript exits 0.

---

### Task 4: Verify rendered wires and mask them beneath node surfaces

**Files:**

- Modify: `src/aws-s3-web/src/components/roadmap/roadmap-canvas.tsx`
- Modify: `src/aws-s3-web/src/components/roadmap/roadmap-shell.test.tsx`
- Modify: `src/aws-s3-web/src/app/roadmap/roadmap.css`
- Modify: `src/aws-s3-web/e2e/roadmap.spec.ts`

**Interfaces:**

- Produces: `.rm-wire[data-from][data-to]` endpoint metadata, opaque themed node surfaces, and a browser-level connector/block collision gate.

- [ ] **Step 1: Add failing component and browser geometry tests**

In `roadmap-shell.test.tsx`, assert every wire exposes both endpoints:

```ts
it("exposes connector endpoints for rendered geometry verification", () => {
  const { container } = render(<RoadmapShell />);
  const wires = [...container.querySelectorAll<SVGPathElement>(".rm-wire")];
  expect(wires.length).toBeGreaterThan(0);
  expect(wires.every((wire) => wire.dataset.from && wire.dataset.to)).toBe(true);
});
```

In `e2e/roadmap.spec.ts`, add this rendered geometry test:

```ts
test("keeps wires out of unrelated blocks and masks the wire layer", async ({ page }) => {
  await page.goto("/roadmap");

  const result = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>(".rm-topic, .rm-subtopic")].map(
      (node) => ({
        id: node.id,
        left: node.offsetLeft,
        top: node.offsetTop,
        right: node.offsetLeft + node.offsetWidth,
        bottom: node.offsetTop + node.offsetHeight,
        backgroundImage: getComputedStyle(node).backgroundImage,
        backgroundColor: getComputedStyle(node).backgroundColor,
      }),
    );
    const collisions = new Set<string>();

    for (const path of document.querySelectorAll<SVGPathElement>(".rm-wire")) {
      const length = path.getTotalLength();
      for (let distance = 3; distance < length - 3; distance += 3) {
        const point = path.getPointAtLength(distance);
        for (const node of nodes) {
          if (node.id === path.dataset.from || node.id === path.dataset.to) continue;
          if (
            point.x > node.left + 2 &&
            point.x < node.right - 2 &&
            point.y > node.top + 2 &&
            point.y < node.bottom - 2
          ) {
            collisions.add(`${path.dataset.connector} -> ${node.id}`);
          }
        }
      }
    }

    const translucentNodes = nodes
      .filter((node) => {
        const channels = node.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
        const alpha = channels.length === 4 ? channels[3] : 1;
        return node.backgroundImage === "none" || alpha !== 1;
      })
      .map((node) => node.id);

    return { collisions: [...collisions], translucentNodes };
  });

  expect(result.collisions).toEqual([]);
  expect(result.translucentNodes).toEqual([]);
});
```

Commit the red renderer contract:

```bash
git diff --check
git add src/aws-s3-web/src/components/roadmap/roadmap-shell.test.tsx src/aws-s3-web/e2e/roadmap.spec.ts
git commit -m "test(roadmap): detect rendered wire collisions"
```

- [ ] **Step 2: Run component and browser tests and observe missing metadata/opacity failures**

```bash
cd src/aws-s3-web
pnpm exec vitest run src/components/roadmap/roadmap-shell.test.tsx
pnpm exec playwright test e2e/roadmap.spec.ts
```

Expected: component test fails because paths lack endpoint attributes; browser opacity assertion fails because node backgrounds are currently translucent color-only fills.

- [ ] **Step 3: Render connector endpoint metadata**

Add these attributes to each `.rm-wire` path in `roadmap-canvas.tsx`:

```tsx
data-connector={connector.id}
data-from={connector.from.nodeId}
data-to={connector.to.nodeId}
```

Commit the renderer metadata:

```bash
git diff --check
git add src/aws-s3-web/src/components/roadmap/roadmap-canvas.tsx
git commit -m "feat(roadmap): expose connector geometry metadata"
```

- [ ] **Step 4: Composite node tints over an opaque theme surface**

In `.rm-box`, replace the translucent shorthand with:

```css
background-color: var(--rm-bg);
background-image: linear-gradient(var(--rm-surface), var(--rm-surface));
```

For every topic/subtopic importance selector, replace `background` with the corresponding tint-only `background-image` while retaining the inherited opaque `background-color`. Examples:

```css
.rm-subtopic[data-importance="core"] {
  background-image: linear-gradient(var(--rm-core-bg), var(--rm-core-bg));
}

.rm-topic {
  background-image: linear-gradient(
    rgb(var(--accent-rgb) / 20%),
    rgb(var(--accent-rgb) / 20%)
  );
}
```

Apply the same form to recommended and optional subtopics/topics with their existing tint tokens and percentages.

Commit the surface correction:

```bash
git diff --check
git add src/aws-s3-web/src/app/roadmap/roadmap.css
git commit -m "fix(roadmap): mask wires beneath node surfaces"
```

- [ ] **Step 5: Run rendered geometry, interaction, and theme tests**

```bash
cd src/aws-s3-web
pnpm exec vitest run src/components/roadmap/roadmap-shell.test.tsx src/components/roadmap/roadmap-node.test.tsx
pnpm exec playwright test e2e/roadmap.spec.ts
```

Expected: endpoint metadata, sampled connector clearance, opaque surfaces, panel interactions, theme contrast, experience stability, and mobile panning all pass.

---

### Task 5: Full regression and visual verification

**Files:**

- Modify only the exact test and implementation pair associated with a defect found during verification.

**Interfaces:**

- Consumes: the complete overlap correction from Tasks 1–4.
- Produces: verified unit, component, browser, build, and visual evidence.

- [ ] **Step 1: Run static checks**

```bash
cd src/aws-s3-web
git diff --check
pnpm lint
pnpm typecheck
```

Expected: commands exit 0. Existing warnings outside roadmap scope may remain documented, but no new warning may originate from a changed roadmap file.

- [ ] **Step 2: Run the complete unit/component suite**

```bash
cd src/aws-s3-web
pnpm test
```

Expected: every Vitest file passes.

- [ ] **Step 3: Run roadmap and portfolio browser regressions**

```bash
cd src/aws-s3-web
pnpm exec playwright test e2e/roadmap.spec.ts e2e/portfolio.spec.ts
```

Expected: connector geometry, roadmap interactions, themes, mobile panning, and homepage isolation pass.

- [ ] **Step 4: Build the static export**

```bash
cd src/aws-s3-web
pnpm build
test -f out/roadmap.html
```

Expected: Next.js exits 0 and `out/roadmap.html` exists. Restore the generated `next-env.d.ts` import to its pre-build value with `apply_patch` if Next.js refreshes it; do not commit that generated-only delta.

- [ ] **Step 5: Inspect four viewport/theme combinations**

Inspect the generated roadmap at:

- 1440×900 dark;
- 1440×900 light;
- 768×1024 light;
- 390×844 dark.

At every size, verify topic/group gaps, readable labels, connector outer lanes, opaque node surfaces, stage visibility, focus outlines, and stable mobile overflow. This inspection creates no tracked file and no commit when it finds no defect.

- [ ] **Step 6: Commit a verification defect only when reproduced by a failing test**

Use exactly one matching commit per defect category:

```bash
git add src/aws-s3-web/src/lib/roadmap/blueprint.test.ts src/aws-s3-web/src/lib/roadmap/blueprint.ts src/aws-s3-web/src/lib/roadmap/roadmap-blueprint.ts
git commit -m "fix(roadmap): correct remaining geometry collision"
```

```bash
git add src/aws-s3-web/src/lib/roadmap/connector-path.test.ts src/aws-s3-web/src/lib/roadmap/connector-path.ts
git commit -m "fix(roadmap): correct remaining connector lane"
```

```bash
git add src/aws-s3-web/e2e/roadmap.spec.ts src/aws-s3-web/src/components/roadmap/roadmap-canvas.tsx src/aws-s3-web/src/app/roadmap/roadmap.css
git commit -m "fix(roadmap): correct remaining rendered overlap"
```

- [ ] **Step 7: Review final scope and history**

```bash
git status --short
git diff --stat origin/feat/roadmap-subdomain...HEAD
git log --oneline --decorate -25
```

Expected: only the approved design, plan, roadmap geometry/routing/rendering files, and their tests are in scope; every file-changing step has a focused commit.
