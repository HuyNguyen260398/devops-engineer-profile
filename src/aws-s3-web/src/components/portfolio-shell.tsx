"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { AboutSection } from "@/components/about-section";
import { AssistantWidget } from "@/components/assistant-widget";
import { BootLoader } from "@/components/boot-loader";
import { BlogsSection } from "@/components/blogs-section";
import { ContactSection } from "@/components/contact-section";
import { ExperienceSection } from "@/components/experience-section";
import { HeroSection } from "@/components/hero-section";
import { ProjectsSection } from "@/components/projects-section";
import { SectionNav } from "@/components/section-nav";
import { SkillsSection } from "@/components/skills/skills-section";
import { ThemeToggle } from "@/components/theme-toggle";
import { useActiveSection } from "@/hooks/use-active-section";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { SectionId } from "@/types/portfolio";

type PortfolioShellProps = {
  children?: ReactNode;
};

export function PortfolioShell({ children }: PortfolioShellProps) {
  const activeSection = useActiveSection();
  const reducedMotion = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);

  const navigate = (section: SectionId) => {
    document.getElementById(section)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const content = children ?? (
    <>
      <HeroSection onNavigate={navigate} reducedMotion={reducedMotion} />
      <AboutSection />
      <SkillsSection reducedMotion={reducedMotion} />
      <ExperienceSection />
      <ProjectsSection />
      <BlogsSection />
      <ContactSection />
      <AssistantWidget />
    </>
  );

  useEffect(() => {
    const root = mainRef.current;
    if (!root) return;

    if (reducedMotion) {
      root.dataset.motionReady = "true";
      return;
    }

    let cancelled = false;
    let animationContext: { revert: () => void } | undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, triggerModule]) => {
        if (cancelled || !mainRef.current) return;
        const gsap = gsapModule.gsap;
        const ScrollTrigger = triggerModule.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);

        animationContext = gsap.context(() => {
          gsap.utils.toArray<HTMLElement>(".reveal").forEach((element) => {
            gsap.fromTo(
              element,
              { opacity: 0, y: 18 },
              {
                opacity: 1,
                y: 0,
                duration: 0.5,
                ease: "power2.out",
                scrollTrigger: { trigger: element, start: "top 90%", once: true },
              },
            );
          });

          [
            ".git-commit",
            ".project-card",
            ".blog-card",
            ".metric-card",
            ".resume-download",
          ].forEach((selector) => {
            ScrollTrigger.batch(selector, {
              start: "top 90%",
              once: true,
              onEnter: (elements) =>
                gsap.fromTo(
                  elements,
                  { opacity: 0, y: 20 },
                  { opacity: 1, y: 0, duration: 0.42, stagger: 0.055, ease: "power2.out" },
                ),
            });
          });
        }, mainRef);

        mainRef.current.dataset.motionReady = "true";
      },
    );

    return () => {
      cancelled = true;
      animationContext?.revert();
    };
  }, [reducedMotion]);

  return (
    <div className="site-shell">
      <BootLoader reducedMotion={reducedMotion} />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="grid-backdrop" aria-hidden="true" />
      <ThemeToggle />
      <SectionNav activeSection={activeSection} onNavigate={navigate} />
      <main id="main-content" ref={mainRef}>{content}</main>
    </div>
  );
}
