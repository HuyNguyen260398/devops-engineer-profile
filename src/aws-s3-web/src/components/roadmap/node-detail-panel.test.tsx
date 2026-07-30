import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NodeDetailPanel } from "./node-detail-panel";
import type { RoadmapNode } from "@/types/roadmap";

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

const multiResourceNode: RoadmapNode = {
  ...node,
  resources: [
    { label: "First resource", url: "https://example.com/first" },
    { label: "Second resource", url: "https://example.com/second" },
  ],
};

describe("NodeDetailPanel", () => {
  it("renders nothing when no node is selected", () => {
    const { container } = render(
      <NodeDetailPanel node={null} showExperience={false} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the node title, why, tools, and resources as a modal dialog", () => {
    render(<NodeDetailPanel node={node} showExperience={false} onClose={() => {}} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("MCP & tool integration")).toBeInTheDocument();
    expect(screen.getByText(node.why)).toBeInTheDocument();
    expect(screen.getByText("JSON-RPC")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Model Context Protocol" });
    expect(link).toHaveAttribute("href", "https://modelcontextprotocol.io/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("shows the experience level only when the overlay is on", () => {
    const { rerender } = render(
      <NodeDetailPanel node={node} showExperience={false} onClose={() => {}} />,
    );
    expect(screen.queryByText("Working knowledge")).not.toBeInTheDocument();

    rerender(<NodeDetailPanel node={node} showExperience onClose={() => {}} />);
    expect(screen.getByText("Working knowledge")).toBeInTheDocument();
  });

  it("closes on the close button", async () => {
    const onClose = vi.fn();
    render(<NodeDetailPanel node={node} showExperience={false} onClose={onClose} />);

    // Two elements match /close/i: the backdrop (aria-label="Close details")
    // and the close control ("Close"). Use the exact-string matcher so only
    // the close control matches.
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<NodeDetailPanel node={node} showExperience={false} onClose={onClose} />);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("moves focus into the panel when it opens", () => {
    render(<NodeDetailPanel node={node} showExperience={false} onClose={() => {}} />);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });

  it("wraps Tab from the last focusable element to the first", async () => {
    render(
      <NodeDetailPanel node={multiResourceNode} showExperience={false} onClose={() => {}} />,
    );

    const lastLink = screen.getByRole("link", { name: "Second resource" });
    lastLink.focus();
    expect(document.activeElement).toBe(lastLink);

    await userEvent.tab();

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });

  it("wraps Shift+Tab from the first focusable element to the last", async () => {
    render(
      <NodeDetailPanel node={multiResourceNode} showExperience={false} onClose={() => {}} />,
    );

    // The close button already has focus on open — it is the first focusable element.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));

    await userEvent.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Second resource" }));
  });
});
