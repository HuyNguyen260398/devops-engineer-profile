import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoadmapDetailPanel } from "./roadmap-detail-panel";
import type { RoadmapStage, RoadmapSubtopic, RoadmapTopic } from "@/types/roadmap";

const argo: RoadmapSubtopic = {
  id: "argo-cd",
  title: "Argo CD",
  importance: "core",
  note: "Pull-based reconciliation with a UI that shows drift as it happens.",
  myLevel: "production",
};

const flux: RoadmapSubtopic = {
  id: "fluxcd",
  title: "FluxCD",
  importance: "recommended",
  note: "The lighter, controller-native alternative.",
  myLevel: "working",
};

const topic: RoadmapTopic = {
  id: "gitops",
  title: "GitOps",
  importance: "core",
  summary: "Git as the deployment source of truth.",
  why: "It turns “what is running in production?” into a git diff.",
  resources: [{ label: "OpenGitOps", url: "https://opengitops.dev/" }],
  myLevel: "production",
  subtopics: [argo, flux],
};

const stage: RoadmapStage = {
  id: "modern-devops",
  index: 1,
  label: "Modern DevOps",
  kicker: "STAGE 01",
  outcome: "You can take a service from a Dockerfile to production.",
  accent: "green",
  topics: [topic],
};

const noop = () => {};

describe("RoadmapDetailPanel", () => {
  it("renders nothing when nothing is selected", () => {
    const { container } = render(
      <RoadmapDetailPanel
        selection={null}
        showExperience={false}
        onClose={noop}
        onOpenTopic={noop}
        onOpenSubtopic={noop}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a topic's summary, why, subtopic list, and resources as a modal dialog", () => {
    render(
      <RoadmapDetailPanel
        selection={{ kind: "topic", topic }}
        showExperience={false}
        onClose={noop}
        onOpenTopic={noop}
        onOpenSubtopic={noop}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "GitOps" })).toBeInTheDocument();
    expect(screen.getByText(topic.summary)).toBeInTheDocument();
    expect(screen.getByText(topic.why)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Argo CD/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OpenGitOps" })).toHaveAttribute(
      "href",
      "https://opengitops.dev/",
    );
  });

  it("drills from a topic into one of its subtopics", async () => {
    const onOpenSubtopic = vi.fn();
    render(
      <RoadmapDetailPanel
        selection={{ kind: "topic", topic }}
        showExperience={false}
        onClose={noop}
        onOpenTopic={noop}
        onOpenSubtopic={onOpenSubtopic}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /FluxCD/ }));
    expect(onOpenSubtopic).toHaveBeenCalledWith("fluxcd");
  });

  it("renders a subtopic's note and links back up to its parent topic", async () => {
    const onOpenTopic = vi.fn();
    render(
      <RoadmapDetailPanel
        selection={{ kind: "subtopic", subtopic: argo, topic }}
        showExperience={false}
        onClose={noop}
        onOpenTopic={onOpenTopic}
        onOpenSubtopic={noop}
      />,
    );

    expect(screen.getByRole("heading", { name: "Argo CD" })).toBeInTheDocument();
    expect(screen.getByText(argo.note)).toBeInTheDocument();
    expect(screen.getByText("Branches off")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /GitOps/ }));
    expect(onOpenTopic).toHaveBeenCalledWith("gitops");
  });

  it("renders a stage's outcome and its topic list", async () => {
    const onOpenTopic = vi.fn();
    render(
      <RoadmapDetailPanel
        selection={{ kind: "stage", stage }}
        showExperience={false}
        onClose={noop}
        onOpenTopic={onOpenTopic}
        onOpenSubtopic={noop}
      />,
    );

    expect(screen.getByRole("heading", { name: "Modern DevOps" })).toBeInTheDocument();
    expect(screen.getByText("STAGE 01")).toBeInTheDocument();
    expect(screen.getByText(stage.outcome)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /GitOps/ }));
    expect(onOpenTopic).toHaveBeenCalledWith("gitops");
  });

  it("hides and shows experience detail with the overlay", () => {
    const { rerender } = render(
      <RoadmapDetailPanel
        selection={{ kind: "subtopic", subtopic: flux, topic }}
        showExperience={false}
        onClose={noop}
        onOpenTopic={noop}
        onOpenSubtopic={noop}
      />,
    );
    expect(screen.queryByText("Working knowledge")).not.toBeInTheDocument();

    rerender(
      <RoadmapDetailPanel
        selection={{ kind: "subtopic", subtopic: flux, topic }}
        showExperience
        onClose={noop}
        onOpenTopic={noop}
        onOpenSubtopic={noop}
      />,
    );
    expect(screen.getByText("Working knowledge")).toBeInTheDocument();
  });

  it("shows topic coverage alongside the topic's own level", () => {
    render(
      <RoadmapDetailPanel
        selection={{ kind: "topic", topic }}
        showExperience
        onClose={noop}
        onOpenTopic={noop}
        onOpenSubtopic={noop}
      />,
    );
    expect(screen.getByText("Production experience")).toBeInTheDocument();
    expect(screen.getByText("2/2 hands-on")).toBeInTheDocument();
  });

  it("closes on Escape and on the close button", async () => {
    const onClose = vi.fn();
    render(
      <RoadmapDetailPanel
        selection={{ kind: "topic", topic }}
        showExperience={false}
        onClose={onClose}
        onOpenTopic={noop}
        onOpenSubtopic={noop}
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
        selection={{ kind: "topic", topic }}
        showExperience={false}
        onClose={noop}
        onOpenTopic={noop}
        onOpenSubtopic={noop}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  });

  it("traps Tab inside the panel in both directions", async () => {
    render(
      <RoadmapDetailPanel
        selection={{ kind: "topic", topic }}
        showExperience={false}
        onClose={noop}
        onOpenTopic={noop}
        onOpenSubtopic={noop}
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
