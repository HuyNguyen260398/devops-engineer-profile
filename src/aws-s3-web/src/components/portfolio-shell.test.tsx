import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { PortfolioShell } from "./portfolio-shell";

it("renders the provided content with accessible navigation and a skip link", () => {
  render(
    <PortfolioShell>
      <section id="hero" aria-label="Sample hero">
        Sample content
      </section>
    </PortfolioShell>,
  );

  expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
    "href",
    "#main-content",
  );
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  expect(screen.getByRole("region", { name: "Sample hero" })).toBeInTheDocument();
});
