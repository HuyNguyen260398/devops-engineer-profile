# DevOps Roadmap 2026 Layout Redesign — Design

**Date:** 2026-08-02

**Area:** `src/aws-s3-web`

**Target branch:** `feat/roadmap-subdomain`

**Status:** Approved for implementation planning

## Summary

Redesign the existing `/roadmap` graph so it has the density, hierarchy, and
branching flow of the 2026 DevOps roadmap on roadmap.sh while retaining the
portfolio's terminal visual identity and original roadmap content.

The result remains an original work. It does not copy roadmap.sh text, images,
assets, or site chrome. The reference informs only the flowchart vocabulary:
compact boxes, framed option groups, curved connectors, and an intentionally
authored poster-like topology.

The existing **Show my experience** overlay and accessible node-detail panel
remain part of the page.

## Goals

- Replace the current simple alternating-spine layout with a dense, authored
  flowchart.
- Preserve every existing stage, topic, subtopic, resource, importance tier,
  and experience annotation from `src/data/roadmap.ts`.
- Preserve the portfolio hero, terminal-window frame, light/dark theme support,
  and route-scoped styling.
- Preserve keyboard-accessible node buttons and the existing detail-panel
  behavior.
- Make the full topology readable on desktop and discoverable through
  horizontal panning on narrow screens.
- Keep content and geometry independently maintainable and independently
  testable.

## Non-goals

- Copying roadmap.sh content, illustrations, assets, navigation, advertisements,
  or surrounding page chrome.
- Replacing the portfolio design system with roadmap.sh colors or typography.
- Adding visitor progress tracking, persistence, authentication, or new APIs.
- Changing the roadmap subdomain infrastructure or CloudFront routing.
- Rewriting the existing detail-panel content model.

## Reference and legal constraint

The visual reference is <https://roadmap.sh/devops?fl=0>. Its repository license
does not allow the roadmap content or images to be republished outside the
project without prior consent. Therefore this redesign uses the portfolio's
existing original 2026 roadmap data and creates new geometry in the same broad
flowchart genre.

No upstream source file, SVG path, coordinate set, topic text, image, or CSS is
copied into this project.

## Existing implementation

The roadmap feature currently lives on `feat/roadmap-subdomain` and consists of:

- `src/app/roadmap/page.tsx` and route-scoped `roadmap.css`;
- `RoadmapShell`, `RoadmapHero`, `RoadmapCanvas`, node, legend, and detail-panel
  components;
- typed content in `src/data/roadmap.ts`;
- a pure `buildRoadmapLayout` function that puts topics on a central vertical
  spine and alternates subtopic columns left and right;
- layout, data, experience, component, and Playwright coverage.

The content and interaction model are already strong. The redesign is limited
to the graph's geometry, rendering hierarchy, route-scoped styles, and tests
that encode those behaviors.

## Chosen approach: authored graph blueprint

Use a fixed coordinate plane with an authored, typed blueprint. The blueprint
maps existing content IDs to visual boxes, framed groups, and connectors.

This approach was chosen over an enhanced automatic layout because the target
quality depends on deliberate composition: clusters need different shapes and
density, option groups need frames, and the main learning route needs to turn
through the canvas rather than repeat one algorithmic pattern.

It was also chosen over embedding or adapting roadmap.sh's renderer because
that would introduce licensing, coupling, accessibility, and maintenance
problems.

## Architecture

### Separation of content and geometry

`src/data/roadmap.ts` remains the authoritative source for labels, descriptions,
resources, importance, and experience. It does not gain pixel coordinates.

A new layout blueprint module under `src/lib/roadmap/` describes only geometry
and references content by stable ID. Its public shape contains:

- canvas width and height;
- node boxes with `nodeId`, `kind`, `x`, `y`, `width`, and `height`;
- framed groups with a stable ID, label, bounds, and member node IDs;
- connector definitions with source and target node IDs plus routing hints;
- optional section annotations used to make the four existing stages legible
  without returning to large stage-divider pills.

The existing data lookup helpers resolve each blueprint reference to its topic
or subtopic. A validation function runs in tests and development to report
duplicate placements, missing references, orphaned content, invalid group
bounds, and connector endpoints that do not exist.

### Coordinate system

The graph uses one fixed-width poster coordinate plane. The desktop terminal
viewport scales that plane uniformly to its available width. All boxes and
connectors share the same coordinate system, avoiding CSS/SVG drift.

The composition begins with a central **DevOps 2026** root. The primary route
then travels through the four content stages using a mix of vertical and
horizontal segments. Topics branch into asymmetric clusters on both sides.
Related alternatives are placed inside labeled frames rather than rendered as
long uniform subtopic columns.

### Rendering layers

`RoadmapCanvas` renders four ordered layers:

1. a background grid and subtle terminal texture;
2. SVG group frames and connector paths;
3. stage annotations and the central root;
4. absolutely positioned HTML buttons for topics and subtopics.

Keeping interactive nodes as HTML buttons preserves semantic keyboard behavior,
focus indicators, text wrapping, the experience overlay, and the existing
detail-panel trigger contract. Decorative SVG content remains
`aria-hidden="true"`.

### Connector routing

Connectors use newly generated cubic or rounded orthogonal paths. A connector
definition names its endpoints and selects one of a small set of explicit
routing modes. The path builder calculates attachment points from box bounds so
minor label-size changes do not require hand-editing raw SVG path strings.

Primary-route connectors use the strongest terminal accent. Branch connectors
use a quieter token and may be dashed where they represent optional or
alternative choices. Connector meaning is also encoded by node labels and
importance text, so color is not the only signal.

## Visual design

- The existing roadmap hero, breadcrumb, terminal titlebar, theme toggle, and
  page background remain.
- The current large pill-shaped stage dividers are replaced by compact stage
  annotations integrated into the graph.
- Primary topics use the strongest terminal accent surface and border.
- Recommended nodes use the existing warm recommendation tokens.
- Optional nodes use muted borders and quieter surfaces.
- Group frames are thin, labeled terminal panels that visually collect choices
  such as operating systems, cloud providers, CI/CD tools, observability, and
  AI/LLMOps.
- Node dimensions follow compact roadmap proportions. Labels wrap to at most two
  lines; the blueprint allocates wider boxes for known long labels instead of
  truncating them.
- Hover, active, and focus-visible states remain subtle and theme-aware.
- No literal color is introduced where an existing `--rm-*` or portfolio token
  can express the role.

## Interaction behavior

### Experience overlay

The **Show my experience** control remains off by default. Enabling it annotates
applicable nodes in place and does not alter graph geometry, connector routing,
or scroll position. The existing overall coverage summary remains visible near
the hero.

### Detail panel

Clicking or activating a topic or subtopic opens the existing detail panel with
the corresponding original content. The redesign preserves:

- `role="dialog"` and `aria-modal="true"`;
- keyboard focus trapping;
- Escape and explicit-close behavior;
- focus restoration to the originating graph button;
- navigation between a topic and its subtopics inside the panel.

### Motion

The graph may use a restrained connector reveal on first render. The animation
must not delay interaction or obscure content. Under `prefers-reduced-motion`,
connectors render immediately and the panel uses no transition.

## Responsive behavior

### Desktop and tablet

The fixed poster plane scales uniformly to the terminal viewport. The topology,
relative positions, and group relationships remain identical at every desktop
and tablet width.

### Narrow screens

Below the existing roadmap breakpoint, the graph stops shrinking at a readable
minimum scale and the viewport scrolls horizontally. A concise hint explains
that the roadmap can be dragged sideways. The graph does not collapse into a
single-column card list because that would destroy the authored topology.

The detail panel continues to occupy the full viewport width on small screens.
No graph control or focus target may be hidden behind the panel after it closes.

## Error handling and invariants

The layout validator enforces these invariants:

- every topic and subtopic in the content appears exactly once in the graph;
- every placed ID resolves to existing content of the declared kind;
- node IDs, group IDs, and connector IDs are unique;
- every connector endpoint resolves to a placed node;
- every group member resolves to a placed node and lies within the group's
  declared bounds;
- every node and group lies inside the canvas;
- box dimensions are positive and meet the configured minimum readable size.

Validation failures are test failures and development errors, not silent visual
fallbacks. The production export uses the already-validated static blueprint.

## Testing strategy

### Unit tests

- Validate the complete authored blueprint against the real roadmap data.
- Cover duplicate IDs, missing content references, orphaned content, invalid
  group membership, out-of-bounds boxes, and missing connector endpoints with
  small synthetic fixtures.
- Cover connector attachment and path generation for each routing mode.
- Keep the existing content-integrity and experience coverage tests.

### Component tests

- Confirm every blueprint node renders as an accessible button with its original
  label.
- Confirm experience annotations appear without moving or replacing node
  controls.
- Keep the existing detail-panel focus, Escape, close, and navigation tests.
- Confirm group labels and stage annotations are present while decorative SVG
  layers remain hidden from assistive technology.

### End-to-end tests

- Load `/roadmap` and verify the authored graph, root, stage annotations, and
  representative groups render.
- Toggle experience and verify annotations appear.
- Open representative topic and subtopic nodes and verify the correct detail
  content and close behavior.
- At a narrow viewport, verify horizontal overflow is available and the scroll
  hint is visible.

### Visual verification

Render the local page at desktop and mobile viewports and compare it with the
reference for topology density, hierarchy, compact node proportions, framed
groups, and connector quality. Comparison is structural; roadmap.sh colors,
copy, site chrome, and exact coordinates are explicitly excluded.

## Acceptance criteria

1. The roadmap uses all existing original content with no missing or duplicate
   topic or subtopic.
2. The graph is an authored multi-directional topology, not a repeated central
   spine with alternating columns.
3. The presentation includes compact node boxes, asymmetric clusters, framed
   option groups, and curved or rounded connectors.
4. The terminal theme, light/dark modes, hero, experience overlay, and detail
   panel are preserved.
5. Nodes remain keyboard accessible and the panel retains its focus behavior.
6. Desktop scales the complete topology to width; mobile provides readable
   horizontal panning.
7. Layout validation, unit tests, component tests, focused end-to-end tests,
   type checking, linting, and the production build pass.
8. No roadmap.sh content, asset, source coordinate, raw SVG path, or CSS is
   copied into the project.
