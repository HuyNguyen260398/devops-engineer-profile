import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { AboutSection } from "./about-section";
import { ExperienceSection } from "./experience-section";
import { ProjectsSection } from "./projects-section";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generated_at: "2026-07-05T12:48:19Z",
        username: "HuyNguyen260398",
        repos: [
          {
            name: "devops-engineer-profile",
            description: "devops-engineer-profile",
            url: "https://github.com/HuyNguyen260398/devops-engineer-profile",
            stars: 1,
            forks: 0,
            primaryLanguage: "HCL",
            languages: ["HCL", "HTML"],
          },
        ],
      }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("renders real work history", () => {
  render(<ExperienceSection />);

  expect(screen.getAllByText("Bosch Global Software Technology Vietnam").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: /DevOps Engineer/ }).length).toBeGreaterThan(0);
  expect(screen.getByText("6 files changed")).toBeInTheDocument();
});

it("shows the seed projects immediately, then swaps in the live-fetched pinned repos", async () => {
  render(<ProjectsSection />);

  expect(screen.getByRole("heading", { name: "aws-cloudops-agent" })).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByRole("heading", { name: "aws-cloudops-agent" })).not.toBeInTheDocument();
  });
  expect(screen.getByRole("heading", { name: "devops-engineer-profile" })).toBeInTheDocument();
});

it("offers the real resume path and only renders projects, not a duplicate repo list", () => {
  render(
    <>
      <AboutSection />
      <ProjectsSection />
    </>,
  );

  expect(screen.getByRole("link", { name: "Download resume" })).toHaveAttribute(
    "href",
    "https://d1k59jrf89m1h2.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf",
  );
  expect(screen.getByRole("link", { name: "Download resume" })).toHaveAttribute("download");
});
