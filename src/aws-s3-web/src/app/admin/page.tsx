"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AuthGuard } from "@/components/blog/auth-guard";
import { BlogShell } from "@/components/blog/blog-shell";
import { getIdToken, signOut } from "@/lib/blog/auth";
import { listPosts, deletePost, type PostMeta } from "@/lib/blog/api";

function Dashboard() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");

  function load() {
    getIdToken()
      .then((token) => listPosts(token ?? undefined))
      .then((p) => {
        setPosts(p);
        setState("ok");
      })
      .catch(() => setState("error"));
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(id: string) {
    const token = await getIdToken();
    if (token && confirm("Delete this post?")) {
      await deletePost(id, token);
      load();
    }
  }

  async function onSignOut() {
    await signOut();
    window.location.href = "/login";
  }

  return (
    <BlogShell
      actions={
        <>
          <Link href="/blogs">view site</Link>
          <button type="button" onClick={onSignOut}>
            sign out
          </button>
        </>
      }
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <h1 className="blog-prompt-heading">~/admin</h1>
        <Link className="terminal-button terminal-button-primary" href="/admin/editor">
          new post
        </Link>
      </div>
      <p className="blog-subhead"># Manage posts — drafts included.</p>

      {state === "loading" && <p className="blog-state">loading…</p>}
      {state === "error" && <p className="blog-state is-error">failed to load posts</p>}
      {state === "ok" && posts.length === 0 && <p className="blog-state">total 0 — no posts yet.</p>}
      {state === "ok" && posts.length > 0 && (
        <ul className="blog-admin-list">
          {posts.map((p) => (
            <li key={p.id} className="blog-admin-row">
              <span>
                {p.title} <em style={{ color: "var(--faint)" }}>[{p.status}]</em>
              </span>
              <span className="blog-row-actions">
                <Link href={`/admin/editor?id=${p.id}`}>edit</Link>
                <button type="button" onClick={() => onDelete(p.id)}>
                  delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </BlogShell>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
