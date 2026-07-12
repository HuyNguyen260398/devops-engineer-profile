import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

export function BlogShell({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="site-shell">
      <div className="grid-backdrop" aria-hidden="true" />
      <ThemeToggle />
      <main className={`blog-container${narrow ? " is-narrow" : ""}`}>{children}</main>
    </div>
  );
}
