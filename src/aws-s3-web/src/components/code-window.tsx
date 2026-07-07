"use client";

import { FolderOpen, Play } from "lucide-react";
import { useEffect, useState } from "react";

type Segment = { text: string; className?: string };
type Line = Segment[];

const ATTR_WIDTH = "experience".length;

function attr(key: string, value: Segment[]): Line {
  return [
    { text: "  " },
    { text: key, className: "code-orange" },
    { text: `${" ".repeat(ATTR_WIDTH - key.length)} = ` },
    ...value,
  ];
}

const lines: Line[] = [
  [{ text: "# Welcome to my workspace", className: "code-comment" }],
  [
    { text: "resource", className: "code-yellow" },
    { text: " " },
    { text: '"devops_engineer"', className: "code-green" },
    { text: " " },
    { text: '"huy"', className: "code-green" },
    { text: " {" },
  ],
  attr("name", [{ text: '"Nguyen Gia Huy"', className: "code-green" }]),
  attr("location", [{ text: '"Ho Chi Minh City, VN"', className: "code-green" }]),
  attr("experience", [
    { text: "5", className: "code-blue" },
    { text: " " },
    { text: "# years", className: "code-comment" },
  ]),
  attr("focus", [
    { text: "[" },
    { text: '"CI/CD"', className: "code-green" },
    { text: ", " },
    { text: '"GitOps"', className: "code-green" },
    { text: ", " },
    { text: '"IaC"', className: "code-green" },
    { text: "]" },
  ]),
  attr("stack", [
    { text: "[" },
    { text: '"AWS"', className: "code-green" },
    { text: ", " },
    { text: '"Azure"', className: "code-green" },
    { text: ", " },
    { text: '"Kubernetes"', className: "code-green" },
    { text: "]" },
  ]),
  attr("status", [{ text: '"available"', className: "code-green" }]),
  [{ text: "}" }],
];

const TYPE_SPEED_MS = 14;

function lineLength(line: Line): number {
  return line.reduce((sum, segment) => sum + segment.text.length, 0);
}

const lineOffsets = lines.reduce<number[]>((offsets, line, index) => {
  offsets.push(index === 0 ? 0 : offsets[index - 1] + lineLength(lines[index - 1]));
  return offsets;
}, []);
const totalChars = lines.reduce((sum, line) => sum + lineLength(line), 0);

function typedSegments(line: Line, charsShown: number): Segment[] {
  if (charsShown <= 0) return [];
  const result: Segment[] = [];
  let remaining = charsShown;

  for (const segment of line) {
    if (remaining <= 0) break;
    if (segment.text.length <= remaining) {
      result.push(segment);
      remaining -= segment.text.length;
    } else {
      result.push({ text: segment.text.slice(0, remaining), className: segment.className });
      remaining = 0;
    }
  }

  return result;
}

type CodeWindowProps = {
  reducedMotion: boolean;
  onRun: () => void;
  onProjects: () => void;
};

export function CodeWindow({ reducedMotion, onRun, onProjects }: CodeWindowProps) {
  const [typedChars, setTypedChars] = useState(reducedMotion ? totalChars : 0);

  useEffect(() => {
    if (reducedMotion || typedChars >= totalChars) return;

    const timer = window.setTimeout(() => {
      setTypedChars((current) => Math.min(current + 1, totalChars));
    }, TYPE_SPEED_MS);

    return () => window.clearTimeout(timer);
  }, [typedChars, reducedMotion]);

  const isTyping = !reducedMotion && typedChars < totalChars;
  const cursorLine = lineOffsets.reduce(
    (current, offset, index) => (typedChars > offset ? index : current),
    0,
  );

  return (
    <div className="code-window reveal">
      <div className="window-titlebar">
        <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
        <div className="window-file"><span aria-hidden="true" /> about-me.tf</div>
        <span className="window-spacer" />
      </div>
      <div className="code-body" aria-label="Terraform profile">
        {lines.map((line, index) => {
          const charsShown = Math.min(Math.max(typedChars - lineOffsets[index], 0), lineLength(line));
          return (
            <div className={charsShown > 0 ? "code-line is-visible" : "code-line"} key={index}>
              <span className="line-number" aria-hidden="true">{index + 1}</span>
              <code>
                {typedSegments(line, charsShown).map((segment, segmentIndex) => (
                  <span className={segment.className} key={segmentIndex}>{segment.text}</span>
                ))}
              </code>
              {isTyping && index === cursorLine ? <span className="typing-caret" aria-hidden="true" /> : null}
            </div>
          );
        })}
        <div className="code-actions">
          <button type="button" className="terminal-button terminal-button-primary" aria-label="Run profile" onClick={onRun}>
            <Play aria-hidden="true" size={16} /> Run Profile
          </button>
          <button type="button" className="terminal-button" aria-label="View projects" onClick={onProjects}>
            <FolderOpen aria-hidden="true" size={16} /> View Projects
          </button>
        </div>
      </div>
    </div>
  );
}
