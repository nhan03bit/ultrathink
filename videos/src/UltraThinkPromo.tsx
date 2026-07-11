import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { Intro } from "./scenes/Intro";
import { Problem } from "./scenes/Problem";
import { Pillars } from "./scenes/Pillars";
import { SkillMesh } from "./scenes/SkillMesh";
import { MemoryDemo } from "./scenes/MemoryDemo";
import { HooksPrivacy } from "./scenes/HooksPrivacy";
import { EditorSupport } from "./scenes/EditorSupport";
import { Stats } from "./scenes/Stats";
import { CTA } from "./scenes/CTA";
import { FPS, theme } from "./theme";
import type { ComponentType } from "react";

type TransitionKind = "cube-right" | "cube-up" | "zoom-through" | "flip" | "swirl" | "portal";

interface SceneDef {
  id: string;
  start: number;
  duration: number;
  Component: ComponentType;
  transition: TransitionKind;
}

const OVERLAP = 0.6; // seconds of overlap for transitions (18 frames)

const scenes: SceneDef[] = [
  { id: "intro", start: 0, duration: 4, Component: Intro, transition: "portal" },
  { id: "problem", start: 3.4, duration: 3.6, Component: Problem, transition: "cube-right" },
  { id: "pillars", start: 6.4, duration: 4, Component: Pillars, transition: "zoom-through" },
  { id: "skillmesh", start: 9.8, duration: 4, Component: SkillMesh, transition: "flip" },
  { id: "memory", start: 13.2, duration: 3.6, Component: MemoryDemo, transition: "cube-up" },
  { id: "hooks", start: 16.2, duration: 3.6, Component: HooksPrivacy, transition: "swirl" },
  { id: "editors", start: 19.2, duration: 3, Component: EditorSupport, transition: "cube-right" },
  { id: "stats", start: 21.6, duration: 3, Component: Stats, transition: "zoom-through" },
  { id: "cta", start: 24, duration: 5, Component: CTA, transition: "portal" },
];

// Per-scene wrapper with 3D enter/exit
function Scene3D({
  children,
  sceneDuration,
  transitionType,
}: {
  children: React.ReactNode;
  sceneDuration: number;
  transitionType: TransitionKind;
}) {
  const frame = useCurrentFrame();
  const enterFrames = 18;
  const exitFrames = 18;

  // Enter animation
  const enterP = interpolate(frame, [0, enterFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Exit animation
  const exitP = interpolate(frame, [sceneDuration - exitFrames, sceneDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const p = Math.max(enterP, exitP);
  const isExiting = exitP > enterP;
  const t = get3DTransform(transitionType, p, isExiting);

  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1400, overflow: "hidden" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transformOrigin: "center center",
          transform: t.transform,
          opacity: t.opacity,
          filter: t.filter,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function get3DTransform(type: TransitionKind, p: number, isExit: boolean) {
  const dir = isExit ? 1 : -1;
  switch (type) {
    case "cube-right":
      return {
        transform: `rotateY(${dir * p * 90}deg) translateZ(${p * -100}px)`,
        opacity: Math.max(0, 1 - p * 0.4),
        filter: p > 0.1 ? `blur(${p * 2}px)` : undefined,
      };
    case "cube-up":
      return {
        transform: `rotateX(${-dir * p * 90}deg) translateZ(${p * -100}px)`,
        opacity: Math.max(0, 1 - p * 0.4),
        filter: p > 0.1 ? `blur(${p * 2}px)` : undefined,
      };
    case "zoom-through":
      return {
        transform: `translate3d(0, 0, ${dir * p * 600}px) scale(${1 + p * 0.3})`,
        opacity: Math.max(0, 1 - p * 1.2),
        filter: p > 0.1 ? `blur(${p * 5}px) brightness(${1 + p * 0.3})` : undefined,
      };
    case "flip":
      return {
        transform: `rotateY(${dir * p * 180}deg) scale(${1 - p * 0.1})`,
        opacity: Math.max(0, 1 - p * 0.6),
        filter: undefined,
      };
    case "swirl":
      return {
        transform: `rotate(${dir * p * 25}deg) scale(${1 - p * 0.4}) translate3d(${dir * p * 80}px, 0, ${p * -400}px)`,
        opacity: Math.max(0, 1 - p * 1.1),
        filter: p > 0.1 ? `blur(${p * 3}px)` : undefined,
      };
    case "portal":
      return {
        transform: `scale(${isExit ? 1 - p * 0.7 : 1 + p * 2}) translate3d(0, 0, ${dir * p * 500}px)`,
        opacity: Math.max(0, 1 - p * 1.2),
        filter: p > 0.1 ? `blur(${p * 6}px) brightness(${1 + p * 0.5})` : undefined,
      };
  }
}

export function UltraThinkPromo() {
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {scenes.map((scene) => {
        const startFrame = Math.round(scene.start * FPS);
        const durationFrames = Math.round(scene.duration * FPS);
        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={durationFrames} name={scene.id}>
            <Scene3D sceneDuration={durationFrames} transitionType={scene.transition}>
              <scene.Component />
            </Scene3D>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
