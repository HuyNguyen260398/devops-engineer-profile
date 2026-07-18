import { DraftPreviewClient } from "./draft-preview-client";

// Static export cannot pre-render unknown slugs; a single `_` shell is exported
// and CloudFront rewrites every /blogs-draft/<slug>/ path to it, then the client
// component reads the real slug from the URL and fetches the draft at runtime.
export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function Page() {
  return <DraftPreviewClient />;
}
