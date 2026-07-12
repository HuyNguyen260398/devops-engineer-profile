"use client";

import { useMemo } from "react";
import NextImage from "next/image";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

import type { PostRecord } from "@/lib/blog/api";

// StarterKit (v3) already bundles Link, Underline, code blocks, lists, etc.;
// only Image is added on top. Keeping the extension list minimal means no raw
// HTML node can be serialized in from stored ProseMirror JSON.
const extensions = [StarterKit, Image];

export function PostView({ post }: { post: PostRecord }) {
  const html = useMemo(() => {
    try {
      return generateHTML(post.body as Record<string, unknown>, extensions);
    } catch {
      return "";
    }
  }, [post.body]);

  return (
    <article className="blog-post-view">
      {post.coverImage && (
        <div className="blog-post-cover">
          <NextImage src={post.coverImage} alt="" fill sizes="(max-width: 820px) 100vw, 820px" priority />
        </div>
      )}
      <h1>{post.title}</h1>
      <p className="blog-post-byline">
        {post.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 10) : "draft"}
        {post.tags.length > 0 && <> · {post.tags.map((t) => `#${t}`).join(" ")}</>}
      </p>
      <div className="blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
