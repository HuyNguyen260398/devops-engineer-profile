"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Scales a fixed-width canvas down to whatever the container can offer, the way
 * roadmap.sh fits its graph to the viewport. Clamped at the bottom so a phone
 * gets a legible, horizontally scrollable graph instead of an unreadable one.
 */
export function useFitScale(
  ref: RefObject<HTMLElement | null>,
  contentWidth: number,
  minScale = 0.46,
): number {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = ref.current;
    // jsdom has no ResizeObserver; the canvas simply renders at 1:1 there.
    if (!element || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const available = element.clientWidth;
      if (!available) return;
      setScale(Math.min(1, Math.max(minScale, available / contentWidth)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, contentWidth, minScale]);

  return scale;
}
