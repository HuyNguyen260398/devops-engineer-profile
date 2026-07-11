import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { BlogsSection } from "./blogs-section";
import { listPosts, type PostMeta } from "@/lib/blog/api";

vi.mock("@/lib/blog/api", () => ({ listPosts: vi.fn() }));

const mockList = vi.mocked(listPosts);

function post(over: Partial<PostMeta> & { id: string; slug: string; title: string }): PostMeta {
  return {
    excerpt: "excerpt",
    tags: [],
    coverImage: null,
    status: "published",
    publishedAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

it("renders published posts linking to their detail pages", async () => {
  mockList.mockResolvedValue([
    post({ id: "1", slug: "first-post", title: "First Post" }),
    post({ id: "2", slug: "second-post", title: "Second Post" }),
  ]);

  render(<BlogsSection />);

  const links = await screen.findAllByRole("link", { name: /Read article/i });
  expect(screen.getByText("First Post")).toBeInTheDocument();
  expect(screen.getByText("Second Post")).toBeInTheDocument();
  expect(links[0]).toHaveAttribute("href", "/blogs/first-post");
});

it("caps the list at 6 posts", async () => {
  mockList.mockResolvedValue(
    Array.from({ length: 9 }, (_, i) => post({ id: `${i}`, slug: `p-${i}`, title: `Post ${i}` })),
  );

  render(<BlogsSection />);

  await waitFor(() => expect(screen.getAllByText(/^Post \d$/)).toHaveLength(6));
});

it("renders a cover image when present and falls back otherwise", async () => {
  mockList.mockResolvedValue([
    post({ id: "1", slug: "with-cover", title: "With Cover", coverImage: "https://cdn.example/c.jpg" }),
    post({ id: "2", slug: "no-cover", title: "No Cover", coverImage: null }),
  ]);

  const { container } = render(<BlogsSection />);

  await screen.findByText("With Cover");
  // Cover images are decorative (alt=""), so query the DOM directly: exactly one
  // <img> for the single post that has a cover.
  expect(container.querySelectorAll("img")).toHaveLength(1);
});

it("shows a terminal empty state when there are no published posts", async () => {
  mockList.mockResolvedValue([]);

  render(<BlogsSection />);

  expect(await screen.findByText("total 0")).toBeInTheDocument();
  expect(screen.getByText("# No pinned blogs yet.")).toBeInTheDocument();
});

it("shows an error state when the API fails", async () => {
  mockList.mockRejectedValue(new Error("boom"));

  render(<BlogsSection />);

  expect(await screen.findByText("# failed to load posts")).toBeInTheDocument();
});
