import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RoadmapShell } from "./roadmap-shell";
import { roadmapStages } from "@/data/roadmap";

describe("RoadmapShell", () => {
  it("renders the page heading and every stage", () => {
    render(<RoadmapShell />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/DevOps Engineer Roadmap/i);
    roadmapStages.forEach((stage) => {
      expect(screen.getByRole("heading", { name: stage.label })).toBeInTheDocument();
    });
  });

  it("starts with the experience overlay off", () => {
    render(<RoadmapShell />);
    expect(screen.getByRole("button", { name: /my experience/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByText("Production experience")).not.toBeInTheDocument();
  });

  it("reveals experience annotations when the overlay is toggled on", async () => {
    render(<RoadmapShell />);

    await userEvent.click(screen.getByRole("button", { name: /my experience/i }));

    expect(screen.getByRole("button", { name: /my experience/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByText("Production experience").length).toBeGreaterThan(0);
  });

  it("opens the detail panel for a node and returns focus to its card on close", async () => {
    render(<RoadmapShell />);

    const card = screen.getByRole("button", { name: /Kubernetes/ });
    await userEvent.click(card);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(card);
  });
});
