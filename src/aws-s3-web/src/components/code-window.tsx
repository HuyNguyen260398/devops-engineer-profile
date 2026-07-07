"use client";

import { FolderOpen, Play } from "lucide-react";
import { useEffect, useState } from "react";

const lines = [
  <><span className="code-comment">{"# Welcome to my workspace"}</span></>,
  <><span className="code-yellow">resource</span> <span className="code-green">&quot;devops_engineer&quot;</span> <span className="code-green">&quot;huy&quot;</span> {"{"}</>,
  <>&nbsp;&nbsp;<span className="code-orange">name</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;Nguyen Gia Huy&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">location</span>&nbsp;&nbsp; = <span className="code-green">&quot;Ho Chi Minh City, VN&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">experience</span> = <span className="code-blue">5</span> <span className="code-comment"># years</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">focus</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = [<span className="code-green">&quot;CI/CD&quot;</span>, <span className="code-green">&quot;GitOps&quot;</span>, <span className="code-green">&quot;IaC&quot;</span>]</>,
  <>&nbsp;&nbsp;<span className="code-orange">stack</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = [<span className="code-green">&quot;AWS&quot;</span>, <span className="code-green">&quot;Azure&quot;</span>, <span className="code-green">&quot;Kubernetes&quot;</span>]</>,
  <>&nbsp;&nbsp;<span className="code-orange">status</span>&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;available&quot;</span></>,
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
        <div className="window-file"><span aria-hidden="true" /> about-me.tf</div>
        <span className="window-spacer" />
      </div>
      <div className="code-body" aria-label="Terraform profile">
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
