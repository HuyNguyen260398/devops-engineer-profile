import { CalendarDays, FileCode2, GitCommitHorizontal } from "lucide-react";

import { SectionHeading } from "@/components/section-heading";
import { portfolio } from "@/data/portfolio";
import { sectionIcons } from "@/components/section-icons";

export function ExperienceSection() {
  return (
    <section className="page-section experience-section" id="experience" aria-labelledby="experience-heading">
      <div id="experience-heading">
        <SectionHeading prefix="$" title="git log --stat --oneline" icon={sectionIcons.experience} />
      </div>
      <div className="experience-timeline">
        {portfolio.experience.map((experience, index) => (
          <article className={index % 2 === 0 ? "git-commit is-even" : "git-commit"} key={experience.id}>
            <div className="commit-period">
              <CalendarDays aria-hidden="true" size={14} />
              {experience.period}
            </div>
            <span className="commit-node" aria-hidden="true" />
            <div className="commit-card">
              <header>
                <span className="commit-hash">{experience.hash}</span>
                <span className="commit-branch">HEAD → {experience.role.split(" ").at(-1)?.toLowerCase()}</span>
                <span className="commit-company">{experience.company}</span>
              </header>
              <div className="commit-body">
                <p className="commit-period-mobile">
                  <CalendarDays aria-hidden="true" size={13} /> {experience.period}
                </p>
                <h3>{experience.role} <span>@ {experience.company}</span></h3>
                <p className="commit-description">{experience.description}</p>
                <div className="tag-row">
                  {experience.technologies.map((technology) => <span key={technology}>{technology}</span>)}
                </div>
              </div>
              <footer>
                <span><FileCode2 aria-hidden="true" size={13} /> {experience.stats.files} files changed</span>
                <span className="insertions">+{experience.stats.insertions} insertions</span>
                <span className="deletions">-{experience.stats.deletions} deletions</span>
              </footer>
            </div>
          </article>
        ))}
        <div className="initial-commit">
          <GitCommitHorizontal aria-hidden="true" size={16} /> Initial Commit (Hello World)
        </div>
      </div>
    </section>
  );
}
