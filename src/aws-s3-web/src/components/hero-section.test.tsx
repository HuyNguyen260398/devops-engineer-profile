import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { HeroSection } from "./hero-section";

it("renders the real identity and emits section actions", async () => {
  const onNavigate = vi.fn();
  const user = userEvent.setup();

  render(<HeroSection onNavigate={onNavigate} reducedMotion />);

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nguyen Gia Huy");
  await user.click(screen.getByRole("button", { name: "Run profile" }));
  await user.click(screen.getByRole("button", { name: "View projects" }));
  expect(onNavigate).toHaveBeenNthCalledWith(1, "about");
  expect(onNavigate).toHaveBeenNthCalledWith(2, "projects");
});

it("links to the roadmap subdomain in a new tab", () => {
  render(<HeroSection onNavigate={() => {}} reducedMotion />);

  const link = screen.getByRole("link", { name: /roadmap/i });
  expect(link).toHaveAttribute("href", "https://roadmap.nghuy.link");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noreferrer");
});
