import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type CfRequest = { uri: string; headers: Record<string, { value: string }> };
type CfHandler = (event: { request: CfRequest }) => CfRequest;

const source = readFileSync(
  join(process.cwd(), "../../inf/terraform/aws-s3-web/cloudfront-rewrite.js"),
  "utf8",
);

// The file is a bare CloudFront Function module: a top-level `function handler`
// with no exports. Evaluate it and hand back the symbol.
const handler = new Function(`${source}; return handler;`)() as CfHandler;

function run(uri: string, host?: string): string {
  const headers = host ? { host: { value: host } } : {};
  return handler({ request: { uri, headers } }).uri;
}

describe("cloudfront-rewrite — apex (pins existing behaviour)", () => {
  const apex = "nghuy.link";

  it.each([
    ["/", "/index.html"],
    ["/blogs", "/blogs.html"],
    ["/blogs/", "/blogs.html"],
    ["/blogs/my-post", "/blogs/_.html"],
    ["/blogs/editor", "/blogs/editor.html"],
    ["/blogs/editor/my-post", "/blogs/editor/_.html"],
    ["/blogs-draft", "/blogs-draft.html"],
    ["/blogs-draft/my-post", "/blogs-draft/_.html"],
    ["/login", "/login.html"],
    ["/roadmap", "/roadmap.html"],
  ])("maps %s to %s", (uri, expected) => {
    expect(run(uri, apex)).toBe(expected);
  });

  it("passes real files through untouched", () => {
    expect(run("/_next/static/chunk.js", apex)).toBe("/_next/static/chunk.js");
    expect(run("/favicon.ico", apex)).toBe("/favicon.ico");
  });

  it("falls back to apex behaviour when the host header is absent", () => {
    expect(run("/")).toBe("/index.html");
    expect(run("/blogs")).toBe("/blogs.html");
  });
});

describe("cloudfront-rewrite — roadmap subdomain", () => {
  const roadmap = "roadmap.nghuy.link";

  it("serves the roadmap page at the subdomain root", () => {
    expect(run("/", roadmap)).toBe("/roadmap.html");
    expect(run("", roadmap)).toBe("/roadmap.html");
  });

  it("normalises a trailing slash at the subdomain root", () => {
    expect(run("/", roadmap)).toBe("/roadmap.html");
  });

  it("maps other clean routes into the /roadmap subtree", () => {
    expect(run("/guide", roadmap)).toBe("/roadmap/guide.html");
  });

  it("shares static assets with the apex", () => {
    expect(run("/_next/static/chunk.js", roadmap)).toBe("/_next/static/chunk.js");
  });
});
