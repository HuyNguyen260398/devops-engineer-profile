import { expect, it } from "vitest";

import { facingOpacity } from "./facing-opacity";

it("hides rear nodes and smoothly reveals front nodes", () => {
  expect(facingOpacity(-0.4)).toBe(0);
  expect(facingOpacity(0.1)).toBe(0);
  expect(facingOpacity(0.35)).toBeCloseTo(0.5);
  expect(facingOpacity(0.8)).toBe(1);
});

