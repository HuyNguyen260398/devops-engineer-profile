import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "geist/font/sans";
import "geist/font/mono";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sample Developer | Platform Engineer",
  description:
    "A sample terminal-inspired engineering portfolio with an interactive Three.js skills universe.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

const themeScript = `
  (() => {
    try {
      const stored = localStorage.getItem("portfolio-theme");
      const theme = stored === "light" || stored === "dark"
        ? stored
        : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch {}
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
