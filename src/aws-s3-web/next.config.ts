import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// `output: "export"` (static HTML export for S3/CloudFront) is a production-build
// concern only. Under it, /blogs/[slug] exports a single "_" shell and CloudFront
// rewrites every /blogs/<slug>/ to it at the edge. The dev server has no such
// rewrite, so applying `output: "export"` in dev makes Next reject any slug not in
// generateStaticParams(). Omitting it in dev lets [slug] render on demand for any
// slug — matching the production edge-rewrite behavior locally.
export default (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    ...(isDev ? {} : { output: "export" }),
    allowedDevOrigins: ["127.0.0.1"],
    images: {
      unoptimized: true,
    },
  };
};
