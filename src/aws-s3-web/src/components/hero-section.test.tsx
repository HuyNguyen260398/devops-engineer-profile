import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { HeroSection } from "./hero-section";

it("renders the sample identity and emits section actions", async () => {
  const onNavigate = vi.fn();
  const user = userEvent.setup();

  render(<HeroSection onNavigate={onNavigate} reducedMotion />);

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sample Developer");
  await user.click(screen.getByRole("button", { name: "Run profile" }));
  await user.click(screen.getByRole("button", { name: "View projects" }));
  expect(onNavigate).toHaveBeenNthCalledWith(1, "about");
  expect(onNavigate).toHaveBeenNthCalledWith(2, "projects");
});
