import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PostView } from "./post-view";

const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello body" }] }] };

describe("PostView", () => {
  it("renders live editor data with a draft byline when publishedAt is null", () => {
    render(<PostView post={{ title: "Live Title", tags: ["aws"], coverImage: null, publishedAt: null, body }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Live Title");
    expect(screen.getByText(/draft/)).toBeInTheDocument();
    expect(screen.getByText(/hello body/)).toBeInTheDocument();
  });
});
