"use client";

import { LEGEND_ENTRIES } from "@/lib/roadmap/experience";
import type { LayoutBox } from "@/lib/roadmap/layout";

export type RoadmapLegendProps = {
  box: LayoutBox;
};

/** The colour key that sits in the top-left corner of the canvas. */
export function RoadmapLegend({ box }: RoadmapLegendProps) {
  return (
    <div
      className="rm-legend"
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
    >
      <ul className="rm-legend-list">
        {LEGEND_ENTRIES.map((entry) => (
          <li key={entry.importance}>
            <span
              className="rm-legend-swatch"
              data-importance={entry.importance}
              style={{ borderColor: entry.color }}
              aria-hidden="true"
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
