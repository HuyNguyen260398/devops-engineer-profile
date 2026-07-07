"use client";

import { Float, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, BackSide, Color, DoubleSide, type Group, type ShaderMaterial } from "three";

import { SkillNode } from "./skill-node";
import { fibonacciSphere } from "./fibonacci-sphere";
import { portfolio } from "@/data/portfolio";

const glowVertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragmentShader = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  void main() {
    float intensity = pow(1.0 + dot(vNormal, vec3(0.0, 0.0, 1.0)), 6.0);
    gl_FragColor = vec4(glowColor, intensity * 0.3);
  }
`;

function OrbitGlow({ lineColor }: { lineColor: string }) {
  const materialRef = useRef<ShaderMaterial>(null);
  const initialColor = useMemo(() => new Color(lineColor), []);

  useEffect(() => {
    materialRef.current?.uniforms.glowColor.value.set(lineColor);
  }, [lineColor]);

  return (
    <mesh scale={1.06}>
      <icosahedronGeometry args={[2.85, 4]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{ glowColor: { value: initialColor } }}
        vertexShader={glowVertexShader}
        fragmentShader={glowFragmentShader}
        transparent
        blending={AdditiveBlending}
        side={BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function SkillsGlobe({ reducedMotion, lineColor }: { reducedMotion: boolean; lineColor: string }) {
  const group = useRef<Group>(null);
  const positions = useMemo(() => fibonacciSphere(portfolio.skills.length, 3.3, 0.78), []);

  useFrame((_, delta) => {
    if (!reducedMotion && group.current) {
      group.current.rotation.y += delta * 0.045;
      group.current.rotation.x = Math.sin(group.current.rotation.y * 0.65) * 0.025;
    }
  });

  return (
    <group ref={group}>
      <OrbitGlow lineColor={lineColor} />
      <mesh>
        <icosahedronGeometry args={[2.85, 2]} />
        <meshBasicMaterial color={lineColor} wireframe transparent opacity={0.16} side={DoubleSide} />
      </mesh>
      {positions.map((position, index) => (
        <SkillNode
          key={portfolio.skills[index].label}
          skill={portfolio.skills[index]}
          position={[position.x, position.y, position.z]}
        />
      ))}
    </group>
  );
}

export default function SkillsCanvas({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [cameraZ, setCameraZ] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? 13 : 9,
  );
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "light"
      ? "light"
      : "dark",
  );

  useEffect(() => {
    const update = () => setCameraZ(window.innerWidth < 768 ? 13 : 9);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setTheme(root.dataset.theme === "light" ? "light" : "dark");
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    updateTheme();
    return () => observer.disconnect();
  }, []);

  const lineColor = theme === "light" ? "#0969da" : "#58a6ff";

  return (
    <Canvas
      camera={{ position: [0, 0, cameraZ], fov: 50 }}
      dpr={[1, 1.5]}
      performance={{ min: 0.5 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={1} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color={lineColor} />
      <Float
        speed={reducedMotion ? 0 : 1}
        rotationIntensity={reducedMotion ? 0 : 0.18}
        floatIntensity={reducedMotion ? 0 : 0.2}
      >
        <SkillsGlobe reducedMotion={reducedMotion} lineColor={lineColor} />
      </Float>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.8}
        maxPolarAngle={Math.PI / 1.5}
        minPolarAngle={Math.PI / 3}
      />
    </Canvas>
  );
}
