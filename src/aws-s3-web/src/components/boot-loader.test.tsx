import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { BootLoader } from "./boot-loader";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("runs a short terminal boot sequence and then removes itself", () => {
  render(<BootLoader reducedMotion={false} />);

  expect(screen.getByRole("status", { name: "Portfolio boot sequence" })).toBeInTheDocument();
  expect(screen.getByText("Mounting interface modules")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");

  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText("Loading skills graph")).toBeInTheDocument();

  act(() => vi.advanceTimersByTime(700));
  expect(screen.getByRole("status", { name: "Portfolio boot sequence" })).toHaveClass(
    "is-exiting",
  );

  act(() => vi.advanceTimersByTime(300));
  expect(screen.queryByRole("status", { name: "Portfolio boot sequence" })).not.toBeInTheDocument();
});

it("bypasses the decorative sequence for reduced-motion visitors", () => {
  render(<BootLoader reducedMotion />);

  act(() => vi.runAllTimers());
  expect(screen.queryByRole("status", { name: "Portfolio boot sequence" })).not.toBeInTheDocument();
});
