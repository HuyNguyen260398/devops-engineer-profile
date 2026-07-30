import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StageRail } from "./stage-rail";
import { roadmapStages } from "@/data/roadmap";

describe("StageRail", () => {
  it("renders a navigation entry for every stage", () => {
    render(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[0].id}
        showExperience={false}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole("navigation", { name: /roadmap stages/i })).toBeInTheDocument();
    roadmapStages.forEach((stage) => {
      expect(screen.getByRole("button", { name: new RegExp(stage.label) })).toBeInTheDocument();
    });
  });

  it("marks only the active stage with aria-current", () => {
    render(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[2].id}
        showExperience={false}
        onSelect={() => {}}
      />,
    );

    const current = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-current") === "true");

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(roadmapStages[2].label);
  });

  it("reports the stage id when an entry is activated", async () => {
    const onSelect = vi.fn();
    render(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[0].id}
        showExperience={false}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: new RegExp(roadmapStages[1].label) }));
    expect(onSelect).toHaveBeenCalledWith(roadmapStages[1].id);
  });

  it("shows coverage bars only when the overlay is on", () => {
    const { container, rerender } = render(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[0].id}
        showExperience={false}
        onSelect={() => {}}
      />,
    );
    expect(container.querySelectorAll(".rm-rail-coverage")).toHaveLength(0);

    rerender(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[0].id}
        showExperience
        onSelect={() => {}}
      />,
    );
    expect(container.querySelectorAll(".rm-rail-coverage")).toHaveLength(roadmapStages.length);
  });
});
