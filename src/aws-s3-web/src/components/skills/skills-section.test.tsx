import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { SkillsSection } from "./skills-section";

it("always exposes an accessible static skill list", () => {
  render(<SkillsSection reducedMotion />);

  expect(screen.getByRole("list", { name: "Technology skills" })).toHaveClass("sr-only");
  expect(screen.getByText("Terraform")).toBeInTheDocument();
  expect(screen.getByText(/Reduced motion mode/)).toBeInTheDocument();
  expect(screen.getByTestId("skills-stage")).toHaveClass("skills-stage--floating");
});
