import type { ReactNode } from "react";
import Link from "next/link";
import { Terminal } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

export function BlogShell({
  children,
  actions,
  narrow = false,
}: {
  children: ReactNode;
  actions?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="site-shell">
      <div className="grid-backdrop" aria-hidden="true" />
      <ThemeToggle />
      <header className="blog-topbar">
        <Link href="/blogs" className="blog-brand">
          <Terminal aria-hidden="true" size={15} />
          nghuy.link/blogs
        </Link>
        <span className="blog-topbar-spacer" />
        <nav>{actions}</nav>
      </header>
      <main className={`blog-container${narrow ? " is-narrow" : ""}`}>{children}</main>
    </div>
  );
}
