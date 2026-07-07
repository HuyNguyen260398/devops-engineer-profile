import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { ExperienceSection } from "./experience-section";
import { ProjectsSection } from "./projects-section";
import { AboutSection } from "./about-section";

it("renders sample history and project cards without remote data", () => {
  render(
    <>
      <ExperienceSection />
      <ProjectsSection />
    </>,
  );

  expect(screen.getByText("Example Labs")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Cloud Control Plane" })).toBeInTheDocument();
  expect(screen.getByText("18 files changed")).toBeInTheDocument();
});

it("offers the future resume path and only renders pinned projects", () => {
  render(
    <>
      <AboutSection />
      <ProjectsSection />
    </>,
  );

  expect(screen.getByRole("link", { name: "Download resume" })).toHaveAttribute(
    "href",
    "/resume.pdf",
  );
  expect(screen.getByRole("link", { name: "Download resume" })).toHaveAttribute("download");
  expect(screen.queryByText("Repositories")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Cloud Control Plane" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Pipeline Observatory" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Runbook Copilot" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Cluster Baselines" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Cost Signal" })).not.toBeInTheDocument();
});
