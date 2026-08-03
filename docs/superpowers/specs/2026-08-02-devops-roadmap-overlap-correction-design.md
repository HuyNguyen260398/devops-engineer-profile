# DevOps Roadmap Overlap Correction — Design

**Date:** 2026-08-02

**Area:** `src/aws-s3-web`

**Target branch:** `feat/roadmap-subdomain`

**Status:** Approved for implementation planning

## Summary

Correct the authored DevOps 2026 poster so topic boxes, framed subtopic groups,
and connector paths remain visually distinct. Preserve the current compact
two-column poster, original content, terminal theme, interactions, canvas size,
and mobile horizontal panning.

## Root cause

The current blueprint places several 300px topic boxes inside the horizontal
bounds occupied by their two-column subtopic grids. For example, the Linux
topic begins at `x = 430`, while its second subtopic column extends through
`x = 492`. Several right-side groups have the inverse problem: their grid
begins at `x = 930`, while the topic extends beyond that point.

Branch connectors also run directly from each topic to both grid columns. A
connector targeting the far column therefore passes through the near column.
Because node fills are translucent, the SVG wire remains visible through the
box and label even though the SVG layer is rendered beneath the HTML buttons.

## Chosen approach

Keep the two-column composition and establish explicit collision-free lanes.
Topics with left-side groups occupy a right central lane; topics with
right-side groups occupy a left central lane. Small variations inside those
lanes retain the authored, multi-directional primary route. Every topic keeps
at least 48px of horizontal clearance from its framed group.

Near-column branches continue to use direct generated connectors. Far-column
branches use generated orthogonal waypoints: leave the topic through the
central gap, travel above the group frame, descend along the outer edge, and
enter the destination from the outside. This keeps the wire away from sibling
boxes and their labels without embedding raw SVG paths in the blueprint.

Node surfaces become visually opaque by compositing the existing translucent
importance tint over the existing roadmap background token. Colors, borders,
importance tiers, hover states, and light/dark theme behavior remain unchanged.

## Geometry rules

- Preserve the 1440×7900 coordinate plane.
- Preserve every topic and subtopic size, group dimensions, and vertical topic
  anchor unless verification proves a vertical collision.
- Keep a minimum 48px horizontal gap between a topic and its own group frame.
- Keep every topic and subtopic rectangle disjoint from every other node.
- Keep group frames disjoint from nodes that are not members of that group.
- Keep primary connectors in the central corridor between left and right
  groups.
- Route far-column branches outside the group frame before entering their
  target from the outer edge.
- Generate all paths through the connector path module; do not store raw SVG
  path strings in the authored blueprint.

## Rendering changes

Connector paths expose their source and target IDs as data attributes for
geometry verification. Interactive elements remain HTML buttons above
decorative `aria-hidden` SVG layers. No detail-panel, experience-overlay,
focus, or keyboard behavior changes.

The existing importance backgrounds remain theme-aware. Each tint is layered
over `--rm-bg`, preventing wires beneath a node from showing through its label.

## Validation and tests

- Extend pure layout validation to report intersecting node rectangles and a
  group frame intersecting any non-member node.
- Add authored-blueprint tests for the 48px topic/group clearance invariant and
  required far-column routing waypoints.
- Add exact connector-path tests for rounded waypoint routing.
- Add a Playwright geometry test that samples every rendered SVG path and
  reports any point lying inside an unrelated topic or subtopic rectangle.
- Preserve the existing complete content, accessibility, theme, interaction,
  mobile overflow, unit, component, browser, lint, type-check, and build gates.
- Visually inspect desktop and mobile in dark and light themes after automated
  geometry checks pass.

## Acceptance criteria

1. No topic or subtopic boxes overlap.
2. No group frame intersects a topic or a node from another group.
3. Every topic has at least 48px clearance from its own group frame.
4. No connector is visible through an unrelated node or label.
5. Far-column connectors use generated outer routing lanes.
6. The 1440×7900 compact topology, original content, terminal theme, detail
   panel, experience overlay, and responsive panning remain intact.
