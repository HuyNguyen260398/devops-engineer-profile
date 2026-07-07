import { describe, expect, it } from "vitest";

import { fibonacciSphere } from "./fibonacci-sphere";

describe("fibonacciSphere", () => {
  it("returns evenly spaced finite points on the requested radius", () => {
    const points = fibonacciSphere(24, 3.3);

    expect(points).toHaveLength(24);
    for (const point of points) {
      expect(Number.isFinite(point.x + point.y + point.z)).toBe(true);
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(3.3, 8);
    }

    const nearestDistances = points.map((point, index) =>
      Math.min(
        ...points
          .filter((_, otherIndex) => otherIndex !== index)
          .map((other) =>
            Math.hypot(point.x - other.x, point.y - other.y, point.z - other.z),
          ),
      ),
    );

    expect(Math.max(...nearestDistances) / Math.min(...nearestDistances)).toBeLessThan(1.7);
  });

  it("handles empty and single-point requests", () => {
    expect(fibonacciSphere(0, 3.3)).toEqual([]);
    expect(fibonacciSphere(1, 3.3)).toEqual([{ x: 0, y: 3.3, z: 0 }]);
  });
});
