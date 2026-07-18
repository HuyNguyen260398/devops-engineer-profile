"use client";

import { useState } from "react";
import NextImage from "next/image";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";

import { EditorToolbar } from "./editor-toolbar";
import { PostView } from "./post-view";
import { useEditorDirty } from "@/context/editor-dirty";
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
  const [preview, setPreview] = useState(false);
  const { setDirty } = useEditorDirty();

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverBusy(true);
    setErr("");
    try {
      setCoverImage(await uploadImage(file));
      setDirty(true);
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
    onUpdate: () => setDirty(true),
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
      setDirty(false);
      // Published posts land on their public detail page; drafts return to the private draft list.
      window.location.href = saved && saved.status === "published" ? `/blogs/${saved.slug}` : "/blogs-draft";
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  const previewData = {
    title,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    coverImage,
    publishedAt: null,
    body: editor?.getJSON() ?? EMPTY_DOC,
  };

  return (
    <>
      <div className="blog-editor-titles">
        <input
          className="blog-editor-title"
          placeholder="Post title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
        />
        <input
          className="blog-input"
          placeholder="Excerpt"
          value={excerpt}
          onChange={(e) => { setExcerpt(e.target.value); setDirty(true); }}
        />
        <input
          className="blog-input"
          placeholder="tags (comma separated)"
          value={tags}
          onChange={(e) => { setTags(e.target.value); setDirty(true); }}
        />

        <div className="blog-editor-cover">
          {coverImage ? (
            <div className="blog-editor-cover-preview">
              <NextImage src={coverImage} alt="" fill sizes="480px" />
              <button
                type="button"
                className="blog-editor-cover-remove"
                onClick={() => { setCoverImage(null); setDirty(true); }}
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
        <button type="button" className="terminal-button" onClick={() => setPreview(true)}>
          preview
        </button>
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

      {preview && (
        <div
          className="blog-session-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="blog-preview-title"
          onClick={() => setPreview(false)}
        >
          <div className="blog-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="blog-preview-modal-head">
              <h2 id="blog-preview-title">preview</h2>
              <button
                type="button"
                className="terminal-button"
                onClick={() => setPreview(false)}
                aria-label="close preview"
              >
                ✕ close
              </button>
            </div>
            <div className="blog-preview-modal-body">
              <PostView post={previewData} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
