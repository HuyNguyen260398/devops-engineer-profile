"use client";

import { useEffect, useRef } from "react";

import {
  IMPORTANCE_LABELS,
  MY_LEVEL_LABELS,
  stageCoverage,
} from "@/lib/roadmap/experience";
import type { RoadmapNode, RoadmapStage } from "@/types/roadmap";

/** Either kind of box on the canvas can drive the panel. */
export type PanelSelection =
  | { kind: "node"; node: RoadmapNode }
  | { kind: "stage"; stage: RoadmapStage };

export type RoadmapDetailPanelProps = {
  selection: PanelSelection | null;
  showExperience: boolean;
  onClose: () => void;
  onOpenNode: (nodeId: string) => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function RoadmapDetailPanel({
  selection,
  showExperience,
  onClose,
  onOpenNode,
}: RoadmapDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!selection) return;
    closeRef.current?.focus();
  }, [selection]);

  useEffect(() => {
    if (!selection) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const targets = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (targets.length === 0) return;

      const first = targets[0];
      const last = targets[targets.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selection, onClose]);

  if (!selection) return null;

  const heading = selection.kind === "node" ? selection.node.title : selection.stage.label;
  const eyebrow =
    selection.kind === "node"
      ? IMPORTANCE_LABELS[selection.node.importance]
      : selection.stage.kicker;

  return (
    <>
      <button
        type="button"
        className="rm-panel-backdrop"
        aria-label="Close details"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="rm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rm-panel-title"
      >
        <div className="rm-panel-head">
          <span
            className="rm-panel-eyebrow"
            data-importance={selection.kind === "node" ? selection.node.importance : undefined}
          >
            {eyebrow}
          </span>
          <button ref={closeRef} type="button" className="rm-panel-close" onClick={onClose}>
            Close
          </button>
        </div>

        <h2 id="rm-panel-title" className="rm-panel-title">
          {heading}
        </h2>

        {selection.kind === "stage" ? (
          <StageBody
            stage={selection.stage}
            showExperience={showExperience}
            onOpenNode={onOpenNode}
          />
        ) : (
          <NodeBody node={selection.node} showExperience={showExperience} />
        )}
      </div>
    </>
  );
}

function NodeBody({ node, showExperience }: { node: RoadmapNode; showExperience: boolean }) {
  return (
    <>
      <p className="rm-panel-summary">{node.summary}</p>
      <p className="rm-panel-why">{node.why}</p>

      {showExperience ? (
        <p className="rm-panel-level" data-level={node.myLevel}>
          {MY_LEVEL_LABELS[node.myLevel]}
        </p>
      ) : null}

      <div className="rm-panel-block">
        <span className="rm-panel-label">Tools</span>
        <ul className="rm-panel-tools">
          {node.tools.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
      </div>

      <div className="rm-panel-block">
        <span className="rm-panel-label">Resources</span>
        <ul className="rm-panel-resources">
          {node.resources.map((resource) => (
            <li key={resource.url}>
              <a href={resource.url} target="_blank" rel="noreferrer">
                {resource.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function StageBody({
  stage,
  showExperience,
  onOpenNode,
}: {
  stage: RoadmapStage;
  showExperience: boolean;
  onOpenNode: (nodeId: string) => void;
}) {
  const coverage = stageCoverage(stage);

  return (
    <>
      <p className="rm-panel-why">{stage.outcome}</p>

      {showExperience ? (
        <p className="rm-panel-level">
          {coverage.practised}/{coverage.total} hands-on
        </p>
      ) : null}

      <div className="rm-panel-block">
        <span className="rm-panel-label">Topics in this stage</span>
        <ul className="rm-panel-topics">
          {stage.nodes.map((node) => (
            <li key={node.id}>
              <button type="button" onClick={() => onOpenNode(node.id)}>
                <span>{node.title}</span>
                <span className="rm-panel-topic-tag" data-importance={node.importance}>
                  {IMPORTANCE_LABELS[node.importance]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
