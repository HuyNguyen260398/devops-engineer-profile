import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PostCard } from "./post-card";

describe("PostCard", () => {
  it("renders title, excerpt, and a link to the slug", () => {
    render(
      <PostCard
        post={{
          id: "1",
          slug: "hello-world",
          title: "Hello World",
          excerpt: "An intro",
          tags: ["aws"],
          coverImage: null,
          status: "published",
          publishedAt: "2026-07-01T00:00:00Z",
          updatedAt: "2026-07-01T00:00:00Z",
        }}
      />,
    );
    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.getByText("An intro")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/blogs/hello-world");
  });
});
