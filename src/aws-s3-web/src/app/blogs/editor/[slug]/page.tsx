import { EditorEditClient } from "./editor-edit-client";

// Static export cannot pre-render unknown slugs; a single `_` shell is exported
// and CloudFront rewrites every /blogs/editor/<slug>/ path to it, then the client
// component reads the real slug from the URL and loads the post at runtime.
export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function Page() {
  return <EditorEditClient />;
}
