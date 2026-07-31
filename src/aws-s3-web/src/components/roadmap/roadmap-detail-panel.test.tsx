import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoadmapDetailPanel } from "./roadmap-detail-panel";
import type { RoadmapNode, RoadmapStage } from "@/types/roadmap";

const node: RoadmapNode = {
  id: "mcp",
  title: "MCP & tool integration",
  importance: "recommended",
  summary: "Wiring real infrastructure tools into agents.",
  why: "The highest-signal portfolio project available right now.",
  tools: ["MCP", "JSON-RPC"],
  resources: [{ label: "Model Context Protocol", url: "https://modelcontextprotocol.io/" }],
  myLevel: "working",
};

const stage: RoadmapStage = {
  id: "ai-layer",
  index: 2,
  label: "AI Layer",
  kicker: "STAGE 02",
  outcome: "You can put AI inside your delivery loops with guardrails.",
  accent: "ai",
  nodes: [node, { ...node, id: "aiops", title: "AIOps", importance: "core", myLevel: "learning" }],
};

describe("RoadmapDetailPanel", () => {
  it("renders nothing when nothing is selected", () => {
    const { container } = render(
      <RoadmapDetailPanel
        selection={null}
        showExperience={false}
        onClose={() => {}}
        onOpenNode={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a node's summary, why, tools, and resources as a modal dialog", () => {
    render(
      <RoadmapDetailPanel
        selection={{ kind: "node", node }}
        showExperience={false}
        onClose={() => {}}
        onOpenNode={() => {}}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "MCP & tool integration" })).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText(node.summary)).toBeInTheDocument();
    expect(screen.getByText(node.why)).toBeInTheDocument();
    expect(screen.getByText("MCP")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Model Context Protocol" })).toHaveAttribute(
      "href",
      "https://modelcontextprotocol.io/",
    );
  });

  it("hides and shows the experience level with the overlay", () => {
    const { rerender } = render(
      <RoadmapDetailPanel
        selection={{ kind: "node", node }}
        showExperience={false}
        onClose={() => {}}
        onOpenNode={() => {}}
      />,
    );
    expect(screen.queryByText("Working knowledge")).not.toBeInTheDocument();

    rerender(
      <RoadmapDetailPanel
        selection={{ kind: "node", node }}
        showExperience
        onClose={() => {}}
        onOpenNode={() => {}}
      />,
    );
    expect(screen.getByText("Working knowledge")).toBeInTheDocument();
  });

  it("renders a stage's outcome and its topic list", async () => {
    const onOpenNode = vi.fn();
    render(
      <RoadmapDetailPanel
        selection={{ kind: "stage", stage }}
        showExperience={false}
        onClose={() => {}}
        onOpenNode={onOpenNode}
      />,
    );

    expect(screen.getByRole("heading", { name: "AI Layer" })).toBeInTheDocument();
    expect(screen.getByText("STAGE 02")).toBeInTheDocument();
    expect(screen.getByText(stage.outcome)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /AIOps/ }));
    expect(onOpenNode).toHaveBeenCalledWith("aiops");
  });

  it("shows stage coverage only when the overlay is on", () => {
    render(
      <RoadmapDetailPanel
        selection={{ kind: "stage", stage }}
        showExperience
        onClose={() => {}}
        onOpenNode={() => {}}
      />,
    );
    // One of the two nodes is "working", the other "learning".
    expect(screen.getByText("1/2 hands-on")).toBeInTheDocument();
  });

  it("closes on Escape and on the close button", async () => {
    const onClose = vi.fn();
    render(
      <RoadmapDetailPanel
        selection={{ kind: "node", node }}
        showExperience={false}
        onClose={onClose}
        onOpenNode={() => {}}
      />,
    );

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("moves focus to the close button when it opens", () => {
    render(
      <RoadmapDetailPanel
        selection={{ kind: "node", node }}
        showExperience={false}
        onClose={() => {}}
        onOpenNode={() => {}}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });

  it("traps Tab inside the panel in both directions", async () => {
    render(
      <RoadmapDetailPanel
        selection={{ kind: "node", node }}
        showExperience={false}
        onClose={() => {}}
        onOpenNode={() => {}}
      />,
    );

    const focusable = Array.from(
      screen.getByRole("dialog").querySelectorAll<HTMLElement>("a[href], button"),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first.focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(last);

    last.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(first);
  });
});
