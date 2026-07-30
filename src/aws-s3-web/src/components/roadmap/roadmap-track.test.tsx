import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoadmapTrack } from "./roadmap-track";
import { roadmapStages } from "@/data/roadmap";

const allNodes = roadmapStages.flatMap((stage) => stage.nodes);

describe("RoadmapTrack", () => {
  it("renders every stage as a section with its own id", () => {
    const { container } = render(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience={false}
        onOpenNode={() => {}}
        onActiveStageChange={() => {}}
      />,
    );

    roadmapStages.forEach((stage) => {
      expect(container.querySelector(`section#${stage.id}`)).not.toBeNull();
      expect(screen.getByRole("heading", { name: stage.label })).toBeInTheDocument();
      expect(screen.getByText(stage.outcome)).toBeInTheDocument();
    });
  });

  it("renders a card for every node in the roadmap", () => {
    render(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience={false}
        onOpenNode={() => {}}
        onActiveStageChange={() => {}}
      />,
    );

    allNodes.forEach((node) => {
      expect(screen.getByText(node.title)).toBeInTheDocument();
    });
  });

  it("reports the node id when a card is activated", async () => {
    const onOpenNode = vi.fn();
    render(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience={false}
        onOpenNode={onOpenNode}
        onActiveStageChange={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Kubernetes/ }));
    expect(onOpenNode).toHaveBeenCalledWith("kubernetes");
  });

  it("shows stage coverage only when the overlay is on", () => {
    const { container, rerender } = render(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience={false}
        onOpenNode={() => {}}
        onActiveStageChange={() => {}}
      />,
    );
    expect(container.querySelectorAll(".rm-stage-coverage")).toHaveLength(0);

    rerender(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience
        onOpenNode={() => {}}
        onActiveStageChange={() => {}}
      />,
    );
    expect(container.querySelectorAll(".rm-stage-coverage")).toHaveLength(roadmapStages.length);
  });

  it("renders without crashing when IntersectionObserver is unavailable", () => {
    expect(() =>
      render(
        <RoadmapTrack
          stages={roadmapStages}
          showExperience={false}
          onOpenNode={() => {}}
          onActiveStageChange={() => {}}
        />,
      ),
    ).not.toThrow();
  });
});
