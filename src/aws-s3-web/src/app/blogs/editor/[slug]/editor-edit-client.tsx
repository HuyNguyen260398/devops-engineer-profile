"use client";

import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/blog/auth-guard";
import { BlogShell } from "@/components/blog/blog-shell";
import { BlogEditor } from "@/components/blog/editor";
import { getIdToken } from "@/lib/blog/auth";
import { getPost, type PostRecord } from "@/lib/blog/api";

function EditScreen() {
  const [initial, setInitial] = useState<PostRecord | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    const slug = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    getIdToken()
      .then((token) => getPost(slug, token ?? undefined))
      .then((p) => {
        setInitial(p);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <BlogShell>
      <h1 className="blog-prompt-heading">edit post</h1>
      {state === "loading" && <p className="blog-state">loading…</p>}
      {state === "error" && <p className="blog-state is-error">post not found</p>}
      {state === "ok" && initial && <BlogEditor initial={initial} />}
    </BlogShell>
  );
}

export function EditorEditClient() {
  return (
    <AuthGuard>
      <EditScreen />
    </AuthGuard>
  );
}
