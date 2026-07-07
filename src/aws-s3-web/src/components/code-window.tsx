"use client";

import { FolderOpen, Play } from "lucide-react";
import { useEffect, useState } from "react";

const lines = [
  <><span className="code-comment">{"# Welcome to the sample workspace"}</span></>,
  <><span className="code-yellow">resource</span> <span className="code-green">&quot;developer&quot;</span> <span className="code-green">&quot;sample&quot;</span> {"{"}</>,
  <>&nbsp;&nbsp;<span className="code-orange">name</span>&nbsp;&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;Sample Developer&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">role</span>&nbsp;&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;Platform Engineer&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">location</span> = <span className="code-green">&quot;Remote / Anywhere&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">focus</span>&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;Reliable Systems&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">stack</span>&nbsp;&nbsp;&nbsp; = [<span className="code-green">&quot;Kubernetes&quot;</span>, <span className="code-green">&quot;Terraform&quot;</span>, <span className="code-green">&quot;AWS&quot;</span>]</>,
  <>&nbsp;&nbsp;<span className="code-orange">status</span>&nbsp;&nbsp; = <span className="code-blue">true</span></>,
  <>{"}"}</>,
];

type CodeWindowProps = {
  reducedMotion: boolean;
  onRun: () => void;
  onProjects: () => void;
};

export function CodeWindow({ reducedMotion, onRun, onProjects }: CodeWindowProps) {
  const [visibleLines, setVisibleLines] = useState(1);
  const renderedLines = reducedMotion ? lines.length : visibleLines;

  useEffect(() => {
    if (reducedMotion) return;

    const timer = window.setInterval(() => {
      setVisibleLines((current) => {
        if (current >= lines.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 115);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <div className="code-window reveal">
      <div className="window-titlebar">
        <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
        <div className="window-file"><span aria-hidden="true" /> portfolio.tf</div>
        <span className="window-spacer" />
      </div>
      <div className="code-body" aria-label="Sample Terraform profile">
        {lines.map((line, index) => (
          <div className={index < renderedLines ? "code-line is-visible" : "code-line"} key={index}>
            <span className="line-number" aria-hidden="true">{index + 1}</span>
            <code>{line}</code>
            {index === renderedLines - 1 && renderedLines < lines.length ? <span className="typing-caret" aria-hidden="true" /> : null}
          </div>
        ))}
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
