"use client";

import { useEffect, useState } from "react";

import { listPosts, type PostMeta } from "@/lib/blog/api";
import { PostCard } from "@/components/blog/post-card";
import { BlogShell } from "@/components/blog/blog-shell";

export default function BlogsPage() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    listPosts()
      .then((p) => {
        setPosts(p);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <BlogShell>
      <h1 className="blog-prompt-heading">ls -la ~/blogs</h1>
      <p className="blog-subhead"># Notes on DevOps, cloud architecture, and platform engineering.</p>

      {state === "loading" && <p className="blog-state">loading…</p>}
      {state === "error" && <p className="blog-state is-error">failed to load posts</p>}
      {state === "ok" && posts.length === 0 && <p className="blog-state">total 0 — no posts yet.</p>}
      {state === "ok" && posts.length > 0 && (
        <div className="blog-grid">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </BlogShell>
  );
}
