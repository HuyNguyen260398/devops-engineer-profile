import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { SectionNav } from "./section-nav";

it("marks the active section and emits navigation selections", async () => {
  const onNavigate = vi.fn();
  const user = userEvent.setup();

  render(<SectionNav activeSection="skills" onNavigate={onNavigate} />);

  expect(screen.getAllByRole("button", { name: "Skills" })[0]).toHaveAttribute(
    "aria-current",
    "location",
  );

  await user.click(screen.getAllByRole("button", { name: "Projects" })[0]);
  expect(onNavigate).toHaveBeenCalledWith("projects");
});

it("uses the exact reference icons for every portfolio section", () => {
  render(<SectionNav activeSection="hero" onNavigate={vi.fn()} />);

  const expectedIcons = {
    Home: "lucide-code-xml",
    About: "lucide-terminal",
    Skills: "lucide-cpu",
    Experience: "lucide-git-branch",
    Projects: "lucide-folder-open",
    Blogs: "lucide-book-open",
    Contact: "lucide-mail",
  };

  for (const [label, iconClass] of Object.entries(expectedIcons)) {
    const icon = screen.getAllByRole("button", { name: label })[0].querySelector("svg");
    expect(icon).toHaveClass(iconClass);
  }
});
