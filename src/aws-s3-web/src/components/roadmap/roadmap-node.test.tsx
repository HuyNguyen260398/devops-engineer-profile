import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoadmapNodeCard } from "./roadmap-node";
import type { ResolvedSubtopic } from "@/lib/roadmap/blueprint";
import type { RoadmapSubtopic } from "@/types/roadmap";

const node: RoadmapSubtopic = {
  id: "helm",
  title: "Helm",
  importance: "core",
  note: "Packaging, values layering, and the release lifecycle most charts assume.",
  myLevel: "production",
};

const entry: ResolvedSubtopic = {
  subtopic: node,
  topicId: "kubernetes",
  stageId: "modern-devops",
  x: 806,
  y: 420,
  width: 282,
  height: 44,
};

describe("RoadmapNodeCard", () => {
  it("renders the label and positions the box in canvas space", () => {
    render(<RoadmapNodeCard subtopic={entry} showExperience={false} onOpen={() => {}} />);

    const box = screen.getByRole("button", { name: /Helm/ });
    expect(box).toHaveTextContent("Helm");
    expect(box).toHaveStyle({ left: "806px", top: "420px", width: "282px", height: "44px" });
  });

  it("carries the importance so the legend colour applies", () => {
    render(<RoadmapNodeCard subtopic={entry} showExperience={false} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: /Helm/ })).toHaveAttribute(
      "data-importance",
      "core",
    );
  });

  it("exposes the note as a tooltip without spending canvas space on it", () => {
    render(<RoadmapNodeCard subtopic={entry} showExperience={false} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: /Helm/ })).toHaveAttribute(
      "title",
      `Core — ${node.note}`,
    );
  });

  it("reports the subtopic id when activated", async () => {
    const onOpen = vi.fn();
    render(<RoadmapNodeCard subtopic={entry} showExperience={false} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("button", { name: /Helm/ }));
    expect(onOpen).toHaveBeenCalledWith("helm");
  });

  it("leaves the experience level off the box when the overlay is off", () => {
    render(<RoadmapNodeCard subtopic={entry} showExperience={false} onOpen={() => {}} />);

    const box = screen.getByRole("button", { name: /Helm/ });
    expect(box).not.toHaveAttribute("data-level");
    expect(box).toHaveAccessibleName("Helm");
  });

  it("annotates the box with the experience level when the overlay is on", () => {
    render(<RoadmapNodeCard subtopic={entry} showExperience onOpen={() => {}} />);

    const box = screen.getByRole("button", { name: /Helm/ });
    expect(box).toHaveAttribute("data-level", "production");
    expect(box).toHaveAccessibleName("Helm, Production experience");
  });

  it("omits the marker for a level the author has not reached", () => {
    const untouched: ResolvedSubtopic = { ...entry, subtopic: { ...node, myLevel: "none" } };
    const { container } = render(
      <RoadmapNodeCard subtopic={untouched} showExperience onOpen={() => {}} />,
    );

    expect(container.querySelector(".rm-box-badge")).toBeNull();
  });
});
