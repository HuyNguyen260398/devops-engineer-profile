"use client";

import { useState } from "react";
import NextImage from "next/image";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";

import { EditorToolbar } from "./editor-toolbar";
import { getIdToken } from "@/lib/blog/auth";
import { uploadImage } from "@/lib/blog/upload";
import { createPost, updatePost, type PostRecord, type PostStatus } from "@/lib/blog/api";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function BlogEditor({ initial }: { initial: PostRecord | null }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [coverImage, setCoverImage] = useState<string | null>(initial?.coverImage ?? null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverBusy(true);
    setErr("");
    try {
      setCoverImage(await uploadImage(file));
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setCoverBusy(false);
      e.target.value = "";
    }
  }

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
        coverImage,
        status,
        body: editor.getJSON(),
      };
      const saved = initial
        ? await updatePost(initial.id, input, token)
        : await createPost(input, token);
      // Published posts land on their public detail page; drafts return to the private draft list.
      window.location.href = saved && saved.status === "published" ? `/blogs/${saved.slug}` : "/blogs-draft";
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

        <div className="blog-editor-cover">
          {coverImage ? (
            <div className="blog-editor-cover-preview">
              <NextImage src={coverImage} alt="" fill sizes="480px" />
              <button
                type="button"
                className="blog-editor-cover-remove"
                onClick={() => setCoverImage(null)}
                aria-label="remove cover image"
              >
                ✕ remove
              </button>
            </div>
          ) : (
            <label className="blog-editor-cover-upload">
              {coverBusy ? "uploading…" : "＋ upload cover image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                hidden
                disabled={coverBusy}
                onChange={onPickCover}
              />
            </label>
          )}
        </div>
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
