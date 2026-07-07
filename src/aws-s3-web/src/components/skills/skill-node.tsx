"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Bot, Cloud } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  SiAnsible,
  SiArgo,
  SiCloudflare,
  SiDocker,
  SiGithub,
  SiGitlab,
  SiGnubash,
  SiGrafana,
  SiHelm,
  SiJenkins,
  SiKubernetes,
  SiLinux,
  SiNextdotjs,
  SiNginx,
  SiNodedotjs,
  SiPostgresql,
  SiPrometheus,
  SiPython,
  SiReact,
  SiRedis,
  SiTerraform,
  SiTypescript,
} from "react-icons/si";
import type { Group } from "three";
import { Vector3 } from "three";

import { facingOpacity } from "./facing-opacity";
import type { Skill } from "@/types/portfolio";

const iconMap = {
  kubernetes: SiKubernetes,
  terraform: SiTerraform,
  aws: Cloud,
  docker: SiDocker,
  linux: SiLinux,
  github: SiGithub,
  gitlab: SiGitlab,
  prometheus: SiPrometheus,
  grafana: SiGrafana,
  ansible: SiAnsible,
  jenkins: SiJenkins,
  argo: SiArgo,
  helm: SiHelm,
  python: SiPython,
  typescript: SiTypescript,
  nextjs: SiNextdotjs,
  react: SiReact,
  nodejs: SiNodedotjs,
  postgresql: SiPostgresql,
  redis: SiRedis,
  openai: Bot,
  cloudflare: SiCloudflare,
  nginx: SiNginx,
  terminal: SiGnubash,
};

type SkillNodeProps = {
  skill: Skill;
  position: [number, number, number];
};

export function SkillNode({ skill, position }: SkillNodeProps) {
  const group = useRef<Group>(null);
  const element = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const worldPosition = useMemo(() => new Vector3(), []);
  const [hovered, setHovered] = useState(false);
  const Icon = iconMap[skill.icon as keyof typeof iconMap] ?? Bot;

  useFrame(({ camera }) => {
    frame.current += 1;
    if (frame.current % 3 !== 0 || !group.current || !element.current) return;

    group.current.lookAt(camera.position);
    group.current.getWorldPosition(worldPosition);
    const dot = worldPosition.clone().normalize().dot(camera.position.clone().normalize());
    const opacity = facingOpacity(dot);

    element.current.style.opacity = String(opacity);
    element.current.style.pointerEvents = opacity > 0.8 ? "auto" : "none";
    element.current.style.transform = "scale(" + (0.82 + opacity * 0.28) + ")";
  });

  return (
    <group ref={group} position={position}>
      <Html transform center distanceFactor={1.32}>
        <div
          ref={element}
          className={hovered ? "skill-node is-hovered" : "skill-node"}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <Icon aria-hidden="true" style={{ color: skill.color }} />
          <span>{skill.label}</span>
        </div>
      </Html>
    </group>
  );
}
