export type SectionId =
  | "hero"
  | "about"
  | "skills"
  | "experience"
  | "projects"
  | "blogs"
  | "contact";

export type NavigationItem = {
  id: SectionId;
  label: string;
  fileLabel: string;
};

export type Skill = {
  label: string;
  icon: string;
  color: string;
};

export type Experience = {
  id: string;
  hash: string;
  company: string;
  role: string;
  period: string;
  description: string;
  technologies: readonly string[];
  stats: {
    files: number;
    insertions: number;
    deletions: number;
  };
};

export type Project = {
  id: string;
  title: string;
  description: string;
  technologies: readonly string[];
  language: string;
  color: string;
  stars: number;
  forks: number;
  featured: boolean;
  href: string;
  demoHref?: string;
};

export type AssistantSuggestion = {
  label: string;
  reply: string;
};

export type PortfolioContent = {
  navigation: readonly NavigationItem[];
  identity: {
    name: string;
    role: string;
    roles: readonly string[];
    eyebrow: string;
    tagline: string;
    summary: string;
    location: string;
    status: string;
    email: string;
  };
  heroModules: readonly string[];
  profile: {
    bio: string;
    mission: string;
    metrics: readonly { label: string; value: string; suffix: string }[];
  };
  skills: readonly Skill[];
  experience: readonly Experience[];
  projects: readonly Project[];
  socials: readonly { label: string; value: string; href: string }[];
  assistant: {
    welcome: string;
    suggestions: readonly AssistantSuggestion[];
  };
};

