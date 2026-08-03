"use client";

import { useRef } from "react";

import { RoadmapLegend } from "@/components/roadmap/roadmap-legend";
import { RoadmapNodeCard } from "@/components/roadmap/roadmap-node";
import { useFitScale } from "@/hooks/use-fit-scale";
import { topicCoverage } from "@/lib/roadmap/experience";
import type { ResolvedRoadmapLayout } from "@/lib/roadmap/blueprint";

export type RoadmapCanvasProps = {
  layout: ResolvedRoadmapLayout;
  showExperience: boolean;
  onOpenTopic: (topicId: string) => void;
  onOpenSubtopic: (subtopicId: string) => void;
  onOpenStage: (stageId: string) => void;
};

/**
 * The flowchart itself, staged as one big terminal window — the same
 * `code-window` chrome the homepage's Terraform preview uses, so the graph
 * reads as another pane of the same editor rather than a different app.
 * Boxes are absolutely positioned in the layout's coordinate space and the
 * connectors are one SVG layer underneath them; the whole plane is then
 * scaled to fit the viewport.
 */
export function RoadmapCanvas({
  layout,
  showExperience,
  onOpenTopic,
  onOpenSubtopic,
  onOpenStage,
}: RoadmapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(viewportRef, layout.width);

  return (
    <div className="code-window rm-terminal">
      <div className="window-titlebar">
        <div className="window-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="window-file">
          <span aria-hidden="true" /> devops-roadmap.tf
        </div>
        <span className="window-spacer" />
      </div>

      {/* Below the breakpoint the canvas hits its minimum scale and the viewport
          scrolls sideways, so say so rather than letting the graph look cropped. */}
      <p className="rm-scroll-hint">{"// drag sideways to see every branch"}</p>

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
              className="rm-groups-layer"
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              aria-hidden="true"
            >
              {layout.groups.map((group) => (
                <g key={group.id} className="rm-group" data-group={group.id}>
                  <rect x={group.x} y={group.y} width={group.width} height={group.height} rx="8" />
                  <text x={group.x + 14} y={group.y + 22}>
                    {group.label}
                  </text>
                </g>
              ))}
            </svg>

            <svg
              className="rm-wires"
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              aria-hidden="true"
              focusable="false"
            >
              {layout.connectors.map((connector) => (
                <path
                  key={connector.id}
                  className="rm-wire"
                  data-connector={connector.id}
                  data-from={connector.from.nodeId}
                  data-kind={connector.kind}
                  data-to={connector.to.nodeId}
                  d={connector.d}
                />
              ))}
            </svg>

            <p
              className="rm-root"
              style={{
                left: layout.root.x,
                top: layout.root.y,
                width: layout.root.width,
                height: layout.root.height,
              }}
            >
              <span className="code-comment">{"// career path"}</span>
              <span>DevOps 2026</span>
            </p>

            <RoadmapLegend box={layout.legend} />

            {layout.stages.map((entry) => (
              <button
                key={entry.stage.id}
                id={entry.stage.id}
                type="button"
                className="rm-stage-annotation"
                data-accent={entry.stage.accent}
                style={{
                  left: entry.x,
                  top: entry.y,
                  width: entry.width,
                  height: entry.height,
                }}
                onClick={() => onOpenStage(entry.stage.id)}
              >
                <span>{entry.stage.kicker}</span>
                {entry.stage.label}
              </button>
            ))}

            {layout.topics.map((entry) => {
              const coverage = topicCoverage(entry.topic);

              return (
                <button
                  key={entry.topic.id}
                  id={entry.topic.id}
                  type="button"
                  className="rm-box rm-topic"
                  data-importance={entry.topic.importance}
                  data-level={showExperience ? entry.topic.myLevel : undefined}
                  style={{
                    left: entry.x,
                    top: entry.y,
                    width: entry.width,
                    height: entry.height,
                  }}
                  onClick={() => onOpenTopic(entry.topic.id)}
                >
                  <span className="rm-box-label">{entry.topic.title}</span>
                  {showExperience ? (
                    <span className="rm-topic-coverage">
                      {coverage.practised}/{coverage.total} hands-on
                    </span>
                  ) : null}
                </button>
              );
            })}

            {layout.subtopics.map((entry) => (
              <RoadmapNodeCard
                key={entry.subtopic.id}
                subtopic={entry}
                showExperience={showExperience}
                onOpen={onOpenSubtopic}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
