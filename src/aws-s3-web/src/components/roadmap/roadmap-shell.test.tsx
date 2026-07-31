import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RoadmapShell } from "./roadmap-shell";
import { roadmapStages } from "@/data/roadmap";

const nodeCount = roadmapStages.reduce((total, stage) => total + stage.nodes.length, 0);

describe("RoadmapShell", () => {
  it("renders the hero heading and a topic box per stage", () => {
    render(<RoadmapShell />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/DevOps Engineer Roadmap/i);
    roadmapStages.forEach((stage) => {
      expect(screen.getByRole("button", { name: new RegExp(stage.label) })).toBeInTheDocument();
    });
  });

  it("renders a subtopic box for every node in the data", () => {
    render(<RoadmapShell />);
    expect(document.querySelectorAll(".rm-subtopic")).toHaveLength(nodeCount);
  });

  it("draws a connector for every stage and every node", () => {
    render(<RoadmapShell />);

    expect(document.querySelectorAll('.rm-wire[data-kind="spine"]')).toHaveLength(
      roadmapStages.length,
    );
    expect(document.querySelectorAll('.rm-wire[data-kind="branch"]')).toHaveLength(nodeCount);
  });

  it("starts with the experience overlay off", () => {
    render(<RoadmapShell />);

    expect(screen.getByRole("button", { name: /my experience/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByText(/Hands-on with/i)).not.toBeInTheDocument();
    expect(document.querySelector(".rm-box-badge")).toBeNull();
  });

  it("reveals experience annotations when the overlay is toggled on", async () => {
    render(<RoadmapShell />);

    await userEvent.click(screen.getByRole("button", { name: /my experience/i }));

    expect(screen.getByRole("button", { name: /my experience/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/Hands-on with \d+ of \d+ topics/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".rm-box-badge").length).toBeGreaterThan(0);
  });

  it("opens the detail panel for a node and returns focus to its box on close", async () => {
    render(<RoadmapShell />);

    const box = screen.getByRole("button", { name: /Kubernetes/ });
    await userEvent.click(box);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Kubernetes" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(box);
  });

  it("opens a stage panel from its topic box and drills into one of its nodes", async () => {
    render(<RoadmapShell />);

    await userEvent.click(screen.getByRole("button", { name: /AI Layer/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "AI Layer" })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /AIOps/ }));
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: "AIOps" }),
    ).toBeInTheDocument();
  });
});
