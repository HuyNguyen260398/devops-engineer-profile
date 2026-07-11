"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getPost, type PostRecord } from "@/lib/blog/api";
import { PostView } from "@/components/blog/post-view";
import { BlogShell } from "@/components/blog/blog-shell";

export function BlogDetailClient() {
  const [post, setPost] = useState<PostRecord | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    const slug = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    getPost(slug)
      .then((p) => {
        setPost(p);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <BlogShell narrow actions={<Link href="/blogs">← all posts</Link>}>
      {state === "loading" && <p className="blog-state">loading…</p>}
      {state === "error" && <p className="blog-state is-error">post not found</p>}
      {state === "ok" && post && <PostView post={post} />}
    </BlogShell>
  );
}
