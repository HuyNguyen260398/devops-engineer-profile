import {
  BookOpen,
  CodeXml,
  Cpu,
  FolderOpen,
  GitBranch,
  Mail,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import type { SectionId } from "@/types/portfolio";

export const sectionIcons = {
  hero: CodeXml,
  about: Terminal,
  skills: Cpu,
  experience: GitBranch,
  projects: FolderOpen,
  blogs: BookOpen,
  contact: Mail,
} satisfies Record<SectionId, LucideIcon>;
