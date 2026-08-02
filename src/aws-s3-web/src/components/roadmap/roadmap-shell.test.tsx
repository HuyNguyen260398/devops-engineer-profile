import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RoadmapShell } from "./roadmap-shell";
import { roadmapStages } from "@/data/roadmap";
import { allSubtopics, allTopics } from "@/lib/roadmap/experience";

const topics = allTopics(roadmapStages);
const subtopics = allSubtopics(roadmapStages);

describe("RoadmapShell", () => {
  it("renders the hero heading", () => {
    render(<RoadmapShell />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/DevOps Engineer Roadmap/i);
  });

  it("renders the authored root, annotations, groups, and every content node", () => {
    render(<RoadmapShell />);

    expect(document.querySelector(".rm-root")).toHaveTextContent("DevOps 2026");
    expect(document.querySelectorAll(".rm-stage-annotation")).toHaveLength(roadmapStages.length);
    expect(document.querySelectorAll(".rm-group").length).toBeGreaterThanOrEqual(10);
    expect(document.querySelectorAll(".rm-topic")).toHaveLength(topics.length);
    expect(document.querySelectorAll(".rm-subtopic")).toHaveLength(subtopics.length);
    expect(document.querySelectorAll('.rm-wire[data-kind="primary"]')).toHaveLength(topics.length);
    expect(
      document.querySelectorAll('.rm-wire[data-kind="branch"], .rm-wire[data-kind="alternative"]'),
    ).toHaveLength(subtopics.length);
  });

  it("keeps decorative layers out of the accessibility tree", () => {
    const { container } = render(<RoadmapShell />);
    expect(container.querySelector(".rm-wires")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".rm-groups-layer")).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes connector endpoints for rendered geometry verification", () => {
    const { container } = render(<RoadmapShell />);
    const wires = [...container.querySelectorAll<SVGPathElement>(".rm-wire")];
    expect(wires.length).toBeGreaterThan(0);
    expect(wires.every((wire) => wire.dataset.from && wire.dataset.to)).toBe(true);
  });

  it("reports the roadmap's size in the hero", () => {
    render(<RoadmapShell />);
    expect(
      screen.getByText(
        `${roadmapStages.length} stages · ${topics.length} topics · ${subtopics.length} subtopics`,
      ),
    ).toBeInTheDocument();
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
    expect(screen.getByText(/Hands-on with \d+ of \d+ subtopics/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".rm-box-badge").length).toBeGreaterThan(0);
  });

  it("opens the detail panel for a subtopic and returns focus to its box on close", async () => {
    render(<RoadmapShell />);

    const box = screen.getByRole("button", { name: /^Helm$/ });
    await userEvent.click(box);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Helm" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(box);
  });

  it("walks stage to topic to subtopic and back up, all inside the panel", async () => {
    render(<RoadmapShell />);

    await userEvent.click(screen.getByRole("button", { name: /AI Layer/ }));

    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "AI Layer" })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /^AIOps/ }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "AIOps" })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /Alert correlation/ }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Alert correlation" })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /^AIOps/ }));
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", { name: "AIOps" }),
    ).toBeInTheDocument();
  });
});
