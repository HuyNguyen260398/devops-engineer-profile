import Link from "next/link";
import { CalendarDays } from "lucide-react";

import type { PostMeta } from "@/lib/blog/api";

export function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link href={`/blogs/${post.slug}`} className="blog-post-card">
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
      <div className="blog-meta">
        {post.publishedAt && (
          <span>
            <CalendarDays aria-hidden="true" size={13} />
            {new Date(post.publishedAt).toISOString().slice(0, 10)}
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
