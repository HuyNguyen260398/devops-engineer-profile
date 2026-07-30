"use client";

import { useEffect, useRef } from "react";

import { MY_LEVEL_LABELS } from "@/lib/roadmap/experience";
import type { RoadmapNode } from "@/types/roadmap";

export type NodeDetailPanelProps = {
  node: RoadmapNode | null;
  showExperience: boolean;
  onClose: () => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function NodeDetailPanel({ node, showExperience, onClose }: NodeDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!node) return;
    closeRef.current?.focus();
  }, [node]);

  useEffect(() => {
    if (!node) return;

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
  }, [node, onClose]);

  if (!node) return null;

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
        <button ref={closeRef} type="button" className="rm-panel-close" onClick={onClose}>
          Close
        </button>

        <h2 id="rm-panel-title" className="rm-panel-title">
          {node.title}
        </h2>
        <p className="rm-panel-why">{node.why}</p>

        {showExperience ? (
          <p className="rm-node-level">{MY_LEVEL_LABELS[node.myLevel]}</p>
        ) : null}

        <div>
          <span className="rm-panel-label">Tools</span>
          <ul className="rm-panel-tools">
            {node.tools.map((tool) => (
              <li key={tool}>{tool}</li>
            ))}
          </ul>
        </div>

        <div>
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
      </div>
    </>
  );
}
