"use client";

import { useEffect, useState } from "react";

import { listDrafts, type PostMeta } from "@/lib/blog/api";
import { getIdToken } from "@/lib/blog/auth";
import { AuthGuard } from "@/components/blog/auth-guard";
import { BlogShell } from "@/components/blog/blog-shell";
import { PostCard } from "@/components/blog/post-card";

function DraftList() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    // Drafts come from the Cognito-required GET /drafts route; a token is required.
    getIdToken()
      .then((token) => {
        if (!token) throw new Error("not authenticated");
        return listDrafts(token);
      })
      .then((p) => {
        setPosts(p);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <BlogShell>
      <h1 className="blog-prompt-heading">ls -la ~/blogs/drafts</h1>
      <p className="blog-subhead"># Unpublished posts — visible only to you. Select one to keep editing.</p>

      {state === "loading" && <p className="blog-state">loading…</p>}
      {state === "error" && <p className="blog-state is-error">failed to load drafts</p>}
      {state === "ok" && posts.length === 0 && <p className="blog-state">total 0 — no drafts yet.</p>}
      {state === "ok" && posts.length > 0 && (
        <div className="blog-grid">
          {posts.map((post) => (
            // Drafts are not publicly reachable; open them in the editor instead.
            <PostCard key={post.id} post={post} href={`/blogs/editor/${post.slug}`} />
          ))}
        </div>
      )}
    </BlogShell>
  );
}

export default function BlogsDraftPage() {
  return (
    <AuthGuard>
      <DraftList />
    </AuthGuard>
  );
}
