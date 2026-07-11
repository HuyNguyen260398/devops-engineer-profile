import Link from "next/link";
import NextImage from "next/image";
import { CalendarDays } from "lucide-react";

import type { PostMeta } from "@/lib/blog/api";

// `href` defaults to the public detail page; the draft list passes the editor
// path since drafts are not publicly reachable.
export function PostCard({ post, href }: { post: PostMeta; href?: string }) {
  const date = post.publishedAt ?? post.updatedAt;
  return (
    <Link href={href ?? `/blogs/${post.slug}`} className="blog-post-card">
      {post.coverImage && (
        <div className="blog-card-cover">
          <NextImage src={post.coverImage} alt="" fill sizes="(max-width: 640px) 100vw, 360px" />
        </div>
      )}
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
      <div className="blog-meta">
        {date && (
          <span>
            <CalendarDays aria-hidden="true" size={13} />
            {new Date(date).toISOString().slice(0, 10)}
          </span>
        )}
        {post.status !== "published" && <span className="blog-status-tag">{post.status}</span>}
        {post.tags.map((t) => (
          <span key={t}>#{t}</span>
        ))}
      </div>
    </Link>
  );
}
