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

  it("throws when an endpoint is not placed", () => {
    const invalid = connector("curve");
    invalid.to.nodeId = "missing";
    expect(() => buildConnectorPath(invalid, boxes)).toThrow("Missing connector box: missing");
  });
});
