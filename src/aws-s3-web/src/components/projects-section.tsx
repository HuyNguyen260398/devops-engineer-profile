"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FolderGit2, GitFork, Star } from "lucide-react";
import { SiGithub } from "react-icons/si";

import { SectionHeading } from "@/components/section-heading";
import { portfolio } from "@/data/portfolio";
import { sectionIcons } from "@/components/section-icons";

type DisplayProject = {
  id: string;
  title: string;
  description: string;
  technologies: readonly string[];
  language: string;
  color: string;
  stars: number;
  forks: number;
  href: string;
  demoHref?: string;
};

type PinnedRepo = {
  name: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  primaryLanguage: string;
  languages: readonly string[];
};

type PinnedReposFile = {
  generated_at: string;
  username: string;
  repos: readonly PinnedRepo[];
};

const languageColors: Record<string, string> = {
  HCL: "#844FBA",
  Python: "#3572A5",
  HTML: "#e34c26",
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  CSS: "#563d7c",
  PHP: "#4F5D95",
  Shell: "#89e051",
  PowerShell: "#012456",
};

function toDisplayProjects(repos: readonly PinnedRepo[]): DisplayProject[] {
  return repos.map((repo) => ({
    id: repo.url,
    title: repo.name,
    description: repo.description || repo.name,
    technologies: repo.languages,
    language: repo.primaryLanguage || "Code",
    color: languageColors[repo.primaryLanguage] ?? "#8b949e",
    stars: repo.stars,
    forks: repo.forks,
    href: repo.url,
  }));
}

const seedProjects: DisplayProject[] = portfolio.projects.filter((project) => project.featured);

export function ProjectsSection() {
  const [projects, setProjects] = useState<DisplayProject[]>(seedProjects);

  useEffect(() => {
    let cancelled = false;

    fetch("/data/pinned-repos.json", { cache: "no-cache" })
      .then((response) => (response.ok ? (response.json() as Promise<PinnedReposFile>) : null))
      .then((data) => {
        if (cancelled || !data || data.repos.length === 0) return;
        setProjects(toDisplayProjects(data.repos));
      })
      .catch(() => {
        // Keep the seed data; the live refresh is a progressive enhancement.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page-section projects-section" id="projects" aria-labelledby="projects-heading">
      <div id="projects-heading"><SectionHeading prefix="$" title="ls -la ~/projects" icon={sectionIcons.projects} /></div>
      <div className="pinned-projects">
          <div className="project-grid">
            {projects.map((project) => (
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
                  {project.demoHref ? (
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
