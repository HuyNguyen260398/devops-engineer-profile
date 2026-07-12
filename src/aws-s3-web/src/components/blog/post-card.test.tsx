import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PostCard } from "./post-card";
import type { PostMeta } from "@/lib/blog/api";

const basePost: PostMeta = {
  id: "1",
  slug: "hello-world",
  title: "Hello World",
  excerpt: "An intro",
  tags: ["aws"],
  coverImage: null,
  status: "published",
  publishedAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};

describe("PostCard", () => {
  it("renders title, excerpt, and a link to the slug", () => {
    render(<PostCard post={basePost} />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.getByText("An intro")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/blogs/hello-world");
  });

  it("renders no cover image when coverImage is null", () => {
    const { container } = render(<PostCard post={basePost} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a cover image when coverImage is set", () => {
    const { container } = render(<PostCard post={{ ...basePost, coverImage: "/media/abc.png" }} />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("uses the href override (e.g. draft cards linking to the editor)", () => {
    render(<PostCard post={basePost} href="/blogs/editor/hello-world" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/blogs/editor/hello-world");
  });
});
