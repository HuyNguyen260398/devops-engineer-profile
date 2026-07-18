import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/blog/auth-guard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/blog/auth", () => ({ getIdToken: () => Promise.resolve("t") }));
const getDraft = vi.fn();
vi.mock("@/lib/blog/api", () => ({ getDraft: (...a: unknown[]) => getDraft(...a) }));

import { DraftPreviewClient } from "./draft-preview-client";

describe("DraftPreviewClient", () => {
  it("fetches the draft by slug and renders it with an edit link", async () => {
    window.history.pushState({}, "", "/blogs-draft/hello-world");
    getDraft.mockResolvedValue({
      id: "1",
      slug: "hello-world",
      title: "Draft Title",
      excerpt: "",
      tags: [],
      coverImage: null,
      status: "draft",
      publishedAt: null,
      updatedAt: "2026-07-15T00:00:00Z",
      body: { type: "doc", content: [{ type: "paragraph" }] },
    });

    render(<DraftPreviewClient />);

    expect(await screen.findByRole("heading", { level: 1, name: "Draft Title" })).toBeInTheDocument();
    expect(getDraft).toHaveBeenCalledWith("hello-world", "t");
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute("href", "/blogs/editor/hello-world");
  });
});
