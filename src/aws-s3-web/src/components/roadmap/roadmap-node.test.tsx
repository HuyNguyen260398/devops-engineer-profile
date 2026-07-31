import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoadmapNodeCard } from "./roadmap-node";
import type { LayoutSubtopic } from "@/lib/roadmap/layout";
import type { RoadmapNode } from "@/types/roadmap";

const node: RoadmapNode = {
  id: "kubernetes",
  title: "Kubernetes",
  importance: "core",
  summary: "Workload primitives and the reconciliation loop.",
  why: "It is the substrate everything else assumes.",
  tools: ["kubectl", "Helm"],
  resources: [{ label: "Docs", url: "https://kubernetes.io/docs/home/" }],
  myLevel: "production",
};

const subtopic: LayoutSubtopic = {
  node,
  stageId: "modern-devops",
  side: "right",
  x: 806,
  y: 420,
  width: 282,
  height: 46,
};

describe("RoadmapNodeCard", () => {
  it("renders the label and positions the box in canvas space", () => {
    render(<RoadmapNodeCard subtopic={subtopic} showExperience={false} onOpen={() => {}} />);

    const box = screen.getByRole("button", { name: /Kubernetes/ });
    expect(box).toHaveTextContent("Kubernetes");
    expect(box).toHaveStyle({ left: "806px", top: "420px", width: "282px", height: "46px" });
  });

  it("carries the importance so the legend colour applies", () => {
    render(<RoadmapNodeCard subtopic={subtopic} showExperience={false} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: /Kubernetes/ })).toHaveAttribute(
      "data-importance",
      "core",
    );
  });

  it("reports the node id when activated", async () => {
    const onOpen = vi.fn();
    render(<RoadmapNodeCard subtopic={subtopic} showExperience={false} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("button", { name: /Kubernetes/ }));
    expect(onOpen).toHaveBeenCalledWith("kubernetes");
  });

  it("leaves the experience level off the box when the overlay is off", () => {
    render(<RoadmapNodeCard subtopic={subtopic} showExperience={false} onOpen={() => {}} />);

    const box = screen.getByRole("button", { name: /Kubernetes/ });
    expect(box).not.toHaveAttribute("data-level");
    expect(box).toHaveAccessibleName("Kubernetes");
  });

  it("annotates the box with the experience level when the overlay is on", () => {
    render(<RoadmapNodeCard subtopic={subtopic} showExperience onOpen={() => {}} />);

    const box = screen.getByRole("button", { name: /Kubernetes/ });
    expect(box).toHaveAttribute("data-level", "production");
    expect(box).toHaveAccessibleName("Kubernetes, Production experience");
  });

  it("omits the marker for a level the author has not reached", () => {
    const untouched: LayoutSubtopic = { ...subtopic, node: { ...node, myLevel: "none" } };
    const { container } = render(
      <RoadmapNodeCard subtopic={untouched} showExperience onOpen={() => {}} />,
    );

    expect(container.querySelector(".rm-box-badge")).toBeNull();
  });
});
