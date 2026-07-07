"use client";

import { ArrowDown, ExternalLink, TerminalSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { SiGithub } from "react-icons/si";

import { CodeWindow } from "@/components/code-window";
import { portfolio } from "@/data/portfolio";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { SectionId } from "@/types/portfolio";

type HeroSectionProps = {
  onNavigate: (section: SectionId) => void;
  reducedMotion?: boolean;
};

function useTypedRole(roles: readonly string[], enabled: boolean): string {
  const [display, setDisplay] = useState(roles[0] ?? "");

  useEffect(() => {
    if (!enabled || roles.length === 0) return;

    let index = 0;
    let position = roles[0].length;
    let deleting = true;
    let timeoutId: number;

    const tick = () => {
      const word = roles[index];
      setDisplay(word.slice(0, position));

      if (deleting) {
        position -= 1;
        if (position < 0) {
          deleting = false;
          index = (index + 1) % roles.length;
          position = 0;
        }
        timeoutId = window.setTimeout(tick, 45);
      } else {
        position += 1;
        if (position > word.length) {
          deleting = true;
          timeoutId = window.setTimeout(tick, 2200);
          return;
        }
        timeoutId = window.setTimeout(tick, 85);
      }
    };

    timeoutId = window.setTimeout(tick, 2600);
    return () => window.clearTimeout(timeoutId);
  }, [roles, enabled]);

  return enabled ? display : (roles[0] ?? "");
}

export function HeroSection({ onNavigate, reducedMotion }: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const reduce = reducedMotion ?? prefersReducedMotion;
  const typedRole = useTypedRole(portfolio.identity.roles, !reduce);

  return (
    <section className="hero-section" id="hero" aria-labelledby="hero-title">
      <span className="hero-decoration hero-decoration-top" aria-hidden="true">&lt;System.Init /&gt;</span>
      <span className="hero-decoration hero-decoration-bottom" aria-hidden="true">while(alive) {"{ code(); }"}</span>
      <div className="hero-grid">
        <div className="hero-copy">
          <div className="system-badge"><span aria-hidden="true" /> {portfolio.identity.eyebrow}</div>
          <div>
            <h1 id="hero-title">
              <span>Hello, I&apos;m</span>
              <strong>{portfolio.identity.name}</strong>
            </h1>
            <p className="hero-role">
              <span className="hero-role-prompt" aria-hidden="true">&gt;</span>
              <span aria-hidden="true">{typedRole}</span>
              {!reduce ? <span className="hero-role-caret" aria-hidden="true" /> : null}
              <span className="sr-only">{portfolio.identity.roles.join(", ")}</span>
            </p>
            <p className="hero-summary">
              {portfolio.identity.tagline} {portfolio.identity.summary}
            </p>
          </div>
          <div className="hero-ctas">
            <button type="button" className="boot-card" onClick={() => onNavigate("about")}>
              <span className="boot-icon"><TerminalSquare aria-hidden="true" size={20} /></span>
              <span className="boot-content">
                <span className="boot-title">Initialize OS <ExternalLink aria-hidden="true" size={12} /></span>
                <span className="boot-progress"><span /></span>
                <span className="boot-meta"><span>&gt; sudo boot_gui</span><strong>Loading...</strong></span>
              </span>
            </button>
            <a
              className="github-card"
              href={portfolio.socials.find((social) => social.label === "GitHub")?.href}
              target="_blank"
              rel="noreferrer"
            >
              <SiGithub aria-hidden="true" size={22} />
              <span><small>Check out</small><strong>GitHub</strong></span>
            </a>
          </div>
          <div className="module-row" aria-label="Loaded modules">
            <span>LOADED_MODULES:</span>
            {portfolio.heroModules.map((module) => <code key={module}>{module.toUpperCase()}</code>)}
          </div>
        </div>
        <CodeWindow
          reducedMotion={reduce}
          onRun={() => onNavigate("about")}
          onProjects={() => onNavigate("projects")}
        />
      </div>
      <button className="scroll-cue" type="button" aria-label="Scroll to about" onClick={() => onNavigate("about")}>
        <ArrowDown aria-hidden="true" size={22} />
      </button>
    </section>
  );
}
