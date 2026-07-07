"use client";

import { useEffect, useState } from "react";

import { portfolio } from "@/data/portfolio";
import type { SectionId } from "@/types/portfolio";

export function useActiveSection(): SectionId {
  const [activeSection, setActiveSection] = useState<SectionId>("hero");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const ratios = new Map<SectionId, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id as SectionId;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let bestId: SectionId | undefined;
        let bestRatio = 0;
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });

        if (bestId) {
          setActiveSection(bestId);
        }
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0, 0.2, 0.5, 0.8] },
    );

    portfolio.navigation.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return activeSection;
}

