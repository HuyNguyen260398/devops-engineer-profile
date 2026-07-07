import Image from "next/image";
import { Activity, Cpu, FileDown, MapPin, UserRound } from "lucide-react";

import { SectionHeading } from "@/components/section-heading";
import { portfolio } from "@/data/portfolio";
import { sectionIcons } from "@/components/section-icons";

const metricIcons = [Activity, Cpu, MapPin] as const;

export function AboutSection() {
  return (
    <section className="page-section about-section" id="about" aria-labelledby="about-heading">
      <div id="about-heading"><SectionHeading prefix="#" title="About.system" icon={sectionIcons.about} /></div>
      <div className="about-grid">
        <article className="profile-card reveal">
          <div className="scan-line" aria-hidden="true" />
          <div className="avatar-system">
            <span className="avatar-ring avatar-ring-one" aria-hidden="true" />
            <span className="avatar-ring avatar-ring-two" aria-hidden="true" />
            <Image src="/avatar.jpg" alt="Portrait of Nguyen Gia Huy" width={160} height={160} priority />
            <span className="online-dot" aria-label="Available" />
          </div>
          <dl className="system-fields">
            <div><dt>OPERATOR</dt><dd>{portfolio.identity.name.toUpperCase()}</dd></div>
            <div><dt>ROLE</dt><dd>{portfolio.identity.role.toUpperCase().replaceAll(" ", "_")}</dd></div>
            <div><dt>LOCATION</dt><dd>{portfolio.identity.location}</dd></div>
            <div><dt>STATUS</dt><dd><span>{portfolio.identity.status}</span></dd></div>
          </dl>
        </article>
        <div className="about-copy reveal">
          <article className="terminal-panel">
            <div className="terminal-panel-header"><UserRound aria-hidden="true" size={14} /> user_profile.log</div>
            <div className="terminal-panel-body">
              <p><strong>➜</strong> <span>whoami</span></p>
              <blockquote>{portfolio.profile.bio}</blockquote>
              <p><strong>➜</strong> <span>cat</span> mission.txt</p>
              <blockquote>{portfolio.profile.mission}</blockquote>
            </div>
          </article>
          <div className="metrics-grid">
            {portfolio.profile.metrics.map((metric, index) => {
              const Icon = metricIcons[index];
              return (
                <article className="metric-card" key={metric.label}>
                  <p><Icon aria-hidden="true" size={16} /> {metric.label}</p>
                  <strong>{metric.value} <small>{metric.suffix}</small></strong>
                </article>
              );
            })}
          </div>
          <a
            className="resume-download"
            href="https://d1k59jrf89m1h2.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
            download="Nguyen-Gia-Huy-DevOps-Engineer.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileDown aria-hidden="true" size={17} /> Download resume
          </a>
        </div>
      </div>
    </section>
  );
}
