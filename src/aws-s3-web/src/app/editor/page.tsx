"use client";

import { AuthGuard } from "@/components/blog/auth-guard";
import { BlogShell } from "@/components/blog/blog-shell";
import { BlogEditor } from "@/components/blog/editor";

export default function NewPostPage() {
  return (
    <AuthGuard>
      <BlogShell>
        <h1 className="blog-prompt-heading">new post</h1>
        <BlogEditor initial={null} />
      </BlogShell>
    </AuthGuard>
  );
}
