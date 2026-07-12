"use client";

import type { Editor } from "@tiptap/react";

import { uploadImage } from "@/lib/blog/upload";

export function EditorToolbar({ editor }: { editor: Editor }) {
  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const src = await uploadImage(file);
      editor.chain().focus().setImage({ src }).run();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      e.target.value = "";
    }
  }

  const cls = (active: boolean) => `blog-tb-btn${active ? " is-active" : ""}`;

  return (
    <div className="blog-editor-toolbar">
      <button type="button" className={cls(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </button>
      <button type="button" className={cls(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        I
      </button>
      <button
        type="button"
        className={cls(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button
        type="button"
        className={cls(editor.isActive("heading", { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </button>
      <button type="button" className={cls(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • list
      </button>
      <button type="button" className={cls(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. list
      </button>
      <button type="button" className={cls(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        code
      </button>
      <button type="button" className={cls(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        quote
      </button>
      <label className="blog-tb-btn" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
        img
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={onPickImage} />
      </label>
    </div>
  );
}
