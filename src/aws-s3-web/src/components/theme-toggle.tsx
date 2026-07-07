"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const storageKey = "portfolio-theme";
const listeners = new Set<() => void>();

function preferredTheme(): Theme {
  const stored = window.localStorage.getItem(storageKey);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme;
    if (currentTheme !== "light" && currentTheme !== "dark") applyTheme(preferredTheme());
  }, []);

  const toggle = () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
  };

  const targetTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${targetTheme} theme`}
      title={`Switch to ${targetTheme} theme`}
      onClick={toggle}
    >
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}
