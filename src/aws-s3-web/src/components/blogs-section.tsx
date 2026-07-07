import { ArrowUpRight, CalendarDays, Clock3, FileText } from "lucide-react";

import { SectionHeading } from "@/components/section-heading";
import { portfolio } from "@/data/portfolio";
import { sectionIcons } from "@/components/section-icons";

export function BlogsSection() {
  return (
    <section className="page-section blogs-section" id="blogs" aria-labelledby="blogs-heading">
      <div id="blogs-heading"><SectionHeading prefix="$" title="ls -la ~/blogs" icon={sectionIcons.blogs} /></div>
      <div className="blog-grid">
        {portfolio.blogs.map((post, index) => (
          <article className="blog-card" key={post.id}>
            <div className="blog-index">0{index + 1}</div>
            <div className="blog-thumb" aria-hidden="true">
              <FileText size={30} />
            </div>
            <div className="blog-meta">
              <span><CalendarDays aria-hidden="true" size={13} />{post.date}</span>
              <span><Clock3 aria-hidden="true" size={13} />{post.readingTime}</span>
            </div>
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
            <div className="tag-row">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <a href={post.href} target="_blank" rel="noreferrer">
              Read sample article <ArrowUpRight aria-hidden="true" size={15} />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
