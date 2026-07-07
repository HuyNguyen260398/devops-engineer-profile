"use client";

import { portfolio } from "@/data/portfolio";
import type { SectionId } from "@/types/portfolio";
import { sectionIcons } from "@/components/section-icons";

type SectionNavProps = {
  activeSection: SectionId;
  onNavigate: (section: SectionId) => void;
};

function NavItems({ activeSection, onNavigate }: SectionNavProps) {
  return portfolio.navigation.map((item) => {
    const Icon = sectionIcons[item.id];
    const active = activeSection === item.id;

    return (
      <button
        type="button"
        className={active ? "section-nav-item is-active" : "section-nav-item"}
        aria-label={item.label}
        aria-current={active ? "location" : undefined}
        onClick={() => onNavigate(item.id)}
        key={item.id}
      >
        <span className="section-nav-tooltip" aria-hidden="true">
          <strong>&gt;</strong> {item.label}
        </span>
        <span className="section-nav-orbit" aria-hidden="true" />
        <span className="section-nav-dot">
          <Icon aria-hidden="true" size={16} />
        </span>
      </button>
    );
  });
}

export function SectionNav({ activeSection, onNavigate }: SectionNavProps) {
  return (
    <>
      <nav className="section-nav-desktop" aria-label="Portfolio sections">
        <NavItems activeSection={activeSection} onNavigate={onNavigate} />
      </nav>
      <nav className="section-nav-mobile" aria-label="Mobile portfolio sections">
        <div className="section-nav-mobile-grid">
          <NavItems activeSection={activeSection} onNavigate={onNavigate} />
        </div>
      </nav>
    </>
  );
}
