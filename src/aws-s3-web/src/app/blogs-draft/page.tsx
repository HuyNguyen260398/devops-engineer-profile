"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { listPosts, type PostMeta } from "@/lib/blog/api";
import { getIdToken } from "@/lib/blog/auth";
import { AuthGuard } from "@/components/blog/auth-guard";
import { BlogShell } from "@/components/blog/blog-shell";

function DraftList() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    // An authenticated GET /posts returns every status; keep only drafts here.
    getIdToken()
      .then((token) => listPosts(token ?? undefined))
      .then((p) => {
        setPosts(p.filter((post) => post.status !== "published"));
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
            <Link key={post.id} href={`/blogs/editor/${post.slug}`} className="blog-post-card">
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <div className="blog-meta">
                <span>
                  <CalendarDays aria-hidden="true" size={13} />
                  {new Date(post.updatedAt).toISOString().slice(0, 10)}
                </span>
                <span className="blog-status-tag">{post.status}</span>
                {post.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            </Link>
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
