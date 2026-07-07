import { ExternalLink, FolderGit2, GitFork, Star } from "lucide-react";
import { SiGithub } from "react-icons/si";

import { SectionHeading } from "@/components/section-heading";
import { portfolio } from "@/data/portfolio";
import { sectionIcons } from "@/components/section-icons";

export function ProjectsSection() {
  const pinnedProjects = portfolio.projects.filter((project) => project.featured);

  return (
    <section className="page-section projects-section" id="projects" aria-labelledby="projects-heading">
      <div id="projects-heading"><SectionHeading prefix="$" title="ls -la ~/projects" icon={sectionIcons.projects} /></div>
      <div className="pinned-projects">
          <div className="project-grid">
            {pinnedProjects.map((project) => (
              <article className="project-card" key={project.id}>
                <div>
                  <header>
                    <FolderGit2 aria-hidden="true" size={17} />
                    <h3>{project.title}</h3>
                    <span>Public</span>
                  </header>
                  <p>{project.description}</p>
                  <div className="tag-row">
                    {project.technologies.map((technology) => <span key={technology}>{technology}</span>)}
                  </div>
                </div>
                <footer>
                  <span><i style={{ background: project.color }} />{project.language}</span>
                  <span><Star aria-hidden="true" size={14} />{project.stars}</span>
                  <span><GitFork aria-hidden="true" size={14} />{project.forks}</span>
                  <a href={project.href} target="_blank" rel="noreferrer">
                    <SiGithub aria-hidden="true" size={12} /> Source
                  </a>
                  {"demoHref" in project && project.demoHref ? (
                    <a className="project-demo-link" href={project.demoHref} target="_blank" rel="noreferrer">
                      Demo <ExternalLink aria-hidden="true" size={12} />
                    </a>
                  ) : null}
                </footer>
              </article>
            ))}
          </div>
      </div>
    </section>
  );
}
