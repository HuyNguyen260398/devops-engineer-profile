"use client";

import { useEffect, useRef } from "react";

import {
  IMPORTANCE_LABELS,
  MY_LEVEL_LABELS,
  stageCoverage,
  topicCoverage,
} from "@/lib/roadmap/experience";
import type { RoadmapStage, RoadmapSubtopic, RoadmapTopic } from "@/types/roadmap";

/** Any box on the canvas can drive the panel. */
export type PanelSelection =
  | { kind: "stage"; stage: RoadmapStage }
  | { kind: "topic"; topic: RoadmapTopic }
  | { kind: "subtopic"; subtopic: RoadmapSubtopic; topic: RoadmapTopic };

export type RoadmapDetailPanelProps = {
  selection: PanelSelection | null;
  showExperience: boolean;
  onClose: () => void;
  onOpenTopic: (topicId: string) => void;
  onOpenSubtopic: (subtopicId: string) => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The panel's tab is named like the file it would be if this were a repo. */
function fileNameFor(selection: PanelSelection): string {
  if (selection.kind === "stage") return `stages/${selection.stage.id}.tf`;
  if (selection.kind === "topic") return `topics/${selection.topic.id}.tf`;
  return `topics/${selection.subtopic.id}.md`;
}

export function RoadmapDetailPanel({
  selection,
  showExperience,
  onClose,
  onOpenTopic,
  onOpenSubtopic,
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

  const { heading, eyebrow, importance } = describe(selection);

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
        className="code-window rm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rm-panel-title"
      >
        <div className="window-titlebar">
          <div className="window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="window-file">
            <span aria-hidden="true" /> {fileNameFor(selection)}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="terminal-button rm-panel-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="rm-panel-body">
          <span className="rm-panel-eyebrow" data-importance={importance}>
            {eyebrow}
          </span>

          <h2 id="rm-panel-title" className="rm-panel-title">
            {heading}
          </h2>

          {selection.kind === "stage" ? (
            <StageBody
              stage={selection.stage}
              showExperience={showExperience}
              onOpenTopic={onOpenTopic}
            />
          ) : selection.kind === "topic" ? (
            <TopicBody
              topic={selection.topic}
              showExperience={showExperience}
              onOpenSubtopic={onOpenSubtopic}
            />
          ) : (
            <SubtopicBody
              subtopic={selection.subtopic}
              topic={selection.topic}
              showExperience={showExperience}
              onOpenTopic={onOpenTopic}
            />
          )}
        </div>
      </div>
    </>
  );
}

function describe(selection: PanelSelection) {
  if (selection.kind === "stage") {
    return {
      heading: selection.stage.label,
      eyebrow: selection.stage.kicker,
      importance: undefined,
    };
  }

  if (selection.kind === "topic") {
    return {
      heading: selection.topic.title,
      eyebrow: IMPORTANCE_LABELS[selection.topic.importance],
      importance: selection.topic.importance,
    };
  }

  return {
    heading: selection.subtopic.title,
    eyebrow: IMPORTANCE_LABELS[selection.subtopic.importance],
    importance: selection.subtopic.importance,
  };
}

function Level({ level }: { level: RoadmapTopic["myLevel"] }) {
  return (
    <p className="rm-panel-level" data-level={level}>
      {MY_LEVEL_LABELS[level]}
    </p>
  );
}

function TopicBody({
  topic,
  showExperience,
  onOpenSubtopic,
}: {
  topic: RoadmapTopic;
  showExperience: boolean;
  onOpenSubtopic: (subtopicId: string) => void;
}) {
  const coverage = topicCoverage(topic);

  return (
    <>
      <p className="rm-panel-summary">{topic.summary}</p>
      <p className="rm-panel-why">{topic.why}</p>

      {showExperience ? (
        <div className="rm-panel-levels">
          <Level level={topic.myLevel} />
          <p className="rm-panel-level" data-level="none">
            {coverage.practised}/{coverage.total} hands-on
          </p>
        </div>
      ) : null}

      <div className="rm-panel-block">
        <span className="rm-panel-label">What this covers</span>
        <ul className="rm-panel-topics">
          {topic.subtopics.map((subtopic) => (
            <li key={subtopic.id}>
              <button type="button" onClick={() => onOpenSubtopic(subtopic.id)}>
                <span>{subtopic.title}</span>
                <span className="rm-panel-topic-tag" data-importance={subtopic.importance}>
                  {IMPORTANCE_LABELS[subtopic.importance]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rm-panel-block">
        <span className="rm-panel-label">Resources</span>
        <ul className="rm-panel-resources">
          {topic.resources.map((resource) => (
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

function SubtopicBody({
  subtopic,
  topic,
  showExperience,
  onOpenTopic,
}: {
  subtopic: RoadmapSubtopic;
  topic: RoadmapTopic;
  showExperience: boolean;
  onOpenTopic: (topicId: string) => void;
}) {
  return (
    <>
      <p className="rm-panel-summary">{subtopic.note}</p>

      {showExperience ? <Level level={subtopic.myLevel} /> : null}

      <div className="rm-panel-block">
        <span className="rm-panel-label">Branches off</span>
        <ul className="rm-panel-topics">
          <li>
            <button type="button" onClick={() => onOpenTopic(topic.id)}>
              <span>{topic.title}</span>
              <span className="rm-panel-topic-tag" data-importance={topic.importance}>
                {IMPORTANCE_LABELS[topic.importance]}
              </span>
            </button>
          </li>
        </ul>
      </div>

      <p className="rm-panel-why">{topic.why}</p>

      <div className="rm-panel-block">
        <span className="rm-panel-label">Resources</span>
        <ul className="rm-panel-resources">
          {topic.resources.map((resource) => (
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
  onOpenTopic,
}: {
  stage: RoadmapStage;
  showExperience: boolean;
  onOpenTopic: (topicId: string) => void;
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
          {stage.topics.map((topic) => (
            <li key={topic.id}>
              <button type="button" onClick={() => onOpenTopic(topic.id)}>
                <span>{topic.title}</span>
                <span className="rm-panel-topic-tag" data-importance={topic.importance}>
                  {IMPORTANCE_LABELS[topic.importance]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
