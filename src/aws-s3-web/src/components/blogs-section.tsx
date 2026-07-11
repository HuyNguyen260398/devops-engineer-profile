"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { ArrowUpRight, CalendarDays, FileText } from "lucide-react";

import { SectionHeading } from "@/components/section-heading";
import { sectionIcons } from "@/components/section-icons";
import { listPosts, type PostMeta } from "@/lib/blog/api";

// The portfolio blogs section surfaces the 6 latest published posts. Data comes
// from the same live API as /blogs (published-only, newest-first), so we only
// slice — no client-side filtering or sorting.
export function BlogsSection() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");

  useEffect(() => {
    listPosts()
      .then((p) => {
        setPosts(p.slice(0, 6));
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <section className="page-section blogs-section" id="blogs" aria-labelledby="blogs-heading">
      <div id="blogs-heading"><SectionHeading prefix="$" title="ls -la ~/blogs" icon={sectionIcons.blogs} /></div>

      {state === "loading" && <p className="blog-state">loading…</p>}

      {state === "error" && (
        <div className="blogs-empty">
          <p className="blogs-empty-prompt">ls -la ~/blogs</p>
          <p className="blogs-empty-comment"># failed to load posts</p>
        </div>
      )}

      {state === "ok" && posts.length === 0 && (
        <div className="blogs-empty">
          <p className="blogs-empty-prompt">ls -la ~/blogs</p>
          <p className="blogs-empty-comment">total 0</p>
          <p className="blogs-empty-comment"># No pinned blogs yet.</p>
        </div>
      )}

      {state === "ok" && posts.length > 0 && (
        <div className="blog-grid">
          {posts.map((post, index) => {
            const date = post.publishedAt ?? post.updatedAt;
            return (
              <article className="blog-card" key={post.id}>
                <div className="blog-index">0{index + 1}</div>
                <div className="blog-thumb" aria-hidden="true">
                  {post.coverImage ? (
                    <NextImage src={post.coverImage} alt="" fill sizes="(max-width: 640px) 100vw, 360px" />
                  ) : (
                    <FileText size={30} />
                  )}
                </div>
                <div className="blog-meta">
                  <span>
                    <CalendarDays aria-hidden="true" size={13} />
                    {new Date(date).toISOString().slice(0, 10)}
                  </span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <div className="tag-row">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <Link href={`/blogs/${post.slug}`}>
                  Read article <ArrowUpRight aria-hidden="true" size={15} />
                </Link>
              </article>
            );
          })}
        </div>
      )}

      <Link className="view-all-link" href="/blogs">
        Visit the blog <ArrowUpRight aria-hidden="true" size={15} />
      </Link>
    </section>
  );
}
