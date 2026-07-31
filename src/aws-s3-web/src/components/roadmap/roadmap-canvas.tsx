"use client";

import { useRef } from "react";

import { RoadmapLegend } from "@/components/roadmap/roadmap-legend";
import { RoadmapNodeCard } from "@/components/roadmap/roadmap-node";
import { useFitScale } from "@/hooks/use-fit-scale";
import { stageCoverage } from "@/lib/roadmap/experience";
import type { RoadmapLayout } from "@/lib/roadmap/layout";

export type RoadmapCanvasProps = {
  layout: RoadmapLayout;
  showExperience: boolean;
  onOpenNode: (nodeId: string) => void;
  onOpenStage: (stageId: string) => void;
};

/**
 * The flowchart itself. Boxes are absolutely positioned in the layout's
 * coordinate space and the connectors are one SVG layer underneath them; the
 * whole plane is then scaled to fit the viewport.
 */
export function RoadmapCanvas({
  layout,
  showExperience,
  onOpenNode,
  onOpenStage,
}: RoadmapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(viewportRef, layout.width);

  return (
    <>
      {/* Below the breakpoint the canvas hits its minimum scale and the viewport
          scrolls sideways, so say so rather than letting the graph look cropped. */}
      <p className="rm-scroll-hint">Drag the graph sideways to see every branch.</p>

      <div className="rm-viewport" ref={viewportRef}>
        <div
          className="rm-scroller"
          style={{ height: layout.height * scale, width: layout.width * scale }}
        >
          <div
            className="rm-canvas"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${scale})`,
            }}
          >
            <svg
              className="rm-wires"
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              aria-hidden="true"
              focusable="false"
            >
              {layout.edges.map((edge) => (
                <path key={edge.id} className="rm-wire" data-kind={edge.kind} d={edge.d} />
              ))}
            </svg>

            <p
              className="rm-canvas-title"
              style={{
                left: layout.title.x,
                top: layout.title.y,
                width: layout.title.width,
                height: layout.title.height,
              }}
            >
              DevOps <span>2026</span>
            </p>

            <RoadmapLegend box={layout.legend} />

            {layout.topics.map((topic) => {
              const coverage = stageCoverage(topic.stage);

              return (
                <button
                  key={topic.stage.id}
                  id={topic.stage.id}
                  type="button"
                  className="rm-box rm-topic"
                  data-accent={topic.stage.accent}
                  style={{
                    left: topic.x,
                    top: topic.y,
                    width: topic.width,
                    height: topic.height,
                  }}
                  onClick={() => onOpenStage(topic.stage.id)}
                >
                  <span className="rm-topic-kicker">{topic.stage.kicker}</span>
                  <span className="rm-box-label">{topic.stage.label}</span>
                  {showExperience ? (
                    <span className="rm-topic-coverage">
                      {coverage.practised}/{coverage.total} hands-on
                    </span>
                  ) : null}
                </button>
              );
            })}

            {layout.subtopics.map((subtopic) => (
              <RoadmapNodeCard
                key={subtopic.node.id}
                subtopic={subtopic}
                showExperience={showExperience}
                onOpen={onOpenNode}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
