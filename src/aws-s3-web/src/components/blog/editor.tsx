"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";

import { EditorToolbar } from "./editor-toolbar";
import { getIdToken } from "@/lib/blog/auth";
import { createPost, updatePost, type PostRecord, type PostStatus } from "@/lib/blog/api";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function BlogEditor({ initial }: { initial: PostRecord | null }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const editor = useEditor({
    extensions: [StarterKit, Image, Placeholder.configure({ placeholder: "Write your post…" })],
    content: (initial?.body as Record<string, unknown>) ?? EMPTY_DOC,
    immediatelyRender: false,
  });

  async function save(status: PostStatus) {
    if (!editor) return;
    setSaving(true);
    setErr("");
    try {
      const token = await getIdToken();
      if (!token) throw new Error("not authenticated");
      const input = {
        title,
        slug: initial?.slug ?? "",
        excerpt,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        coverImage: initial?.coverImage ?? null,
        status,
        body: editor.getJSON(),
      };
      if (initial) await updatePost(initial.id, input, token);
      else await createPost(input, token);
      window.location.href = "/admin";
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      <div className="blog-editor-titles">
        <input
          className="blog-editor-title"
          placeholder="Post title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="blog-input"
          placeholder="Excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
        />
        <input
          className="blog-input"
          placeholder="tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      {editor && <EditorToolbar editor={editor} />}
      <div className="blog-editor-surface">
        <EditorContent editor={editor} />
      </div>

      <div className="blog-editor-actions">
        <button type="button" className="terminal-button" disabled={saving} onClick={() => save("draft")}>
          save draft
        </button>
        <button
          type="button"
          className="terminal-button terminal-button-primary"
          disabled={saving}
          onClick={() => save("published")}
        >
          publish
        </button>
      </div>
      {err && <p className="blog-error">{err}</p>}
    </>
  );
}
