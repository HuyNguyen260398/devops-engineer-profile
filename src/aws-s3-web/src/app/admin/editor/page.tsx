"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AuthGuard } from "@/components/blog/auth-guard";
import { BlogShell } from "@/components/blog/blog-shell";
import { BlogEditor } from "@/components/blog/editor";
import { getIdToken } from "@/lib/blog/auth";
import { getPost, listPosts, type PostRecord } from "@/lib/blog/api";

function EditorRoute() {
  const [initial, setInitial] = useState<PostRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    const loadInitial = async (): Promise<PostRecord | null> => {
      if (!id) return null;
      const token = await getIdToken();
      const all = await listPosts(token ?? undefined);
      const meta = all.find((p) => p.id === id);
      return meta ? await getPost(meta.slug, token ?? undefined) : null;
    };
    loadInitial().then((p) => {
      setInitial(p);
      setReady(true);
    });
  }, []);

  return (
    <BlogShell actions={<Link href="/admin">← admin</Link>}>
      <h1 className="blog-prompt-heading">{initial ? "edit post" : "new post"}</h1>
      {!ready ? <p className="blog-state">loading…</p> : <BlogEditor initial={initial} />}
    </BlogShell>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <EditorRoute />
    </AuthGuard>
  );
}
