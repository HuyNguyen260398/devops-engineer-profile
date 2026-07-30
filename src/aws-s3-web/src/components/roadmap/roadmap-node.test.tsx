import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoadmapNodeCard } from "./roadmap-node";
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

describe("RoadmapNodeCard", () => {
  it("renders the title, summary, and importance label", () => {
    render(<RoadmapNodeCard node={node} showExperience={false} onOpen={() => {}} />);
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("Workload primitives and the reconciliation loop.")).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
  });

  it("is an accessible button that reports the node id when activated", async () => {
    const onOpen = vi.fn();
    render(<RoadmapNodeCard node={node} showExperience={false} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("button", { name: /Kubernetes/ }));
    expect(onOpen).toHaveBeenCalledWith("kubernetes");
  });

  it("hides the experience label when the overlay is off", () => {
    render(<RoadmapNodeCard node={node} showExperience={false} onOpen={() => {}} />);
    expect(screen.queryByText("Production experience")).not.toBeInTheDocument();
  });

  it("shows the experience label when the overlay is on", () => {
    render(<RoadmapNodeCard node={node} showExperience onOpen={() => {}} />);
    expect(screen.getByText("Production experience")).toBeInTheDocument();
  });
});
