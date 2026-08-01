import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RoadmapShell } from "./roadmap-shell";
import { roadmapStages } from "@/data/roadmap";
import { allSubtopics, allTopics } from "@/lib/roadmap/experience";

const topics = allTopics(roadmapStages);
const subtopics = allSubtopics(roadmapStages);

describe("RoadmapShell", () => {
  it("renders the hero heading and a divider per stage", () => {
    render(<RoadmapShell />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/DevOps Engineer Roadmap/i);
    expect(document.querySelectorAll(".rm-stage-label")).toHaveLength(roadmapStages.length);
  });

  it("renders a box for every topic and every subtopic in the data", () => {
    render(<RoadmapShell />);

    expect(document.querySelectorAll(".rm-topic")).toHaveLength(topics.length);
    expect(document.querySelectorAll(".rm-subtopic")).toHaveLength(subtopics.length);
  });

  it("draws a spine segment per stage and topic, and a branch per subtopic", () => {
    render(<RoadmapShell />);

    expect(document.querySelectorAll('.rm-wire[data-kind="spine"]')).toHaveLength(
      roadmapStages.length + topics.length,
    );
    expect(document.querySelectorAll('.rm-wire[data-kind="branch"]')).toHaveLength(
      subtopics.length,
    );
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
