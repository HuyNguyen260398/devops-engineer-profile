"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AuthGuard } from "@/components/blog/auth-guard";
import { BlogShell } from "@/components/blog/blog-shell";
import { PostView } from "@/components/blog/post-view";
import { getIdToken } from "@/lib/blog/auth";
import { getDraft, type PostRecord } from "@/lib/blog/api";

function DraftPreview() {
  const [post, setPost] = useState<PostRecord | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    const s = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    getIdToken()
      .then((token) => {
        if (!token) throw new Error("not authenticated");
        return getDraft(s, token);
      })
      .then((p) => {
        setPost(p);
        setSlug(s);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <BlogShell narrow>
      {state === "loading" && <p className="blog-state">loading…</p>}
      {state === "error" && <p className="blog-state is-error">draft not found</p>}
      {state === "ok" && post && (
        <>
          <PostView post={post} />
          <div className="blog-editor-actions">
            <Link className="terminal-button" href={`/blogs/editor/${slug}`} prefetch={false}>
              edit
            </Link>
          </div>
        </>
      )}
    </BlogShell>
  );
}

export function DraftPreviewClient() {
  return (
    <AuthGuard>
      <DraftPreview />
    </AuthGuard>
  );
}
