"use client";

import { useEffect, useState, type ReactNode } from "react";

import { currentUser } from "@/lib/blog/auth";
import { EditorDirtyProvider } from "@/context/editor-dirty";
import { SessionTimeout } from "@/components/blog/session-timeout";

export function AuthGuard({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    currentUser().then((u) => {
      if (!u) {
        window.location.href = "/login";
        return;
      }
      setOk(true);
    });
  }, []);

  if (ok === null) return <p className="blog-state">checking session…</p>;
  return (
    <EditorDirtyProvider>
      {children}
      <SessionTimeout />
    </EditorDirtyProvider>
  );
}
