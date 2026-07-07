import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { BlogsSection } from "./blogs-section";

it("shows a terminal empty state when there are no pinned posts", () => {
  render(<BlogsSection />);

  expect(screen.getByText("total 0")).toBeInTheDocument();
  expect(screen.getByText("# No pinned blogs yet.")).toBeInTheDocument();
});
