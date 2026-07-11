import { type ReactNode } from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { theme } from "../theme";

type TransitionType = "cube-right" | "cube-up" | "zoom-through" | "flip" | "swirl" | "portal";

// 3D scene-to-scene transition wrapper
export function Transition3D({
  children,
  type,
  durationInFrames,
  direction = "enter",
}: {
  children: ReactNode;
  type: TransitionType;
  durationInFrames: number;
  direction?: "enter" | "exit";
}) {
  const frame = useCurrentFrame();
  const isExit = direction === "exit";
  const progress = interpolate(
    frame,
    isExit ? [durationInFrames - 12, durationInFrames] : [0, 12],
    isExit ? [0, 1] : [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }
  );

  // progress: 1 = fully transitioned (off-screen), 0 = fully visible
  const transforms = getTransform(type, progress, isExit);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        perspective: 1200,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: transforms.transform,
          opacity: transforms.opacity,
          filter: transforms.filter,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function getTransform(type: TransitionType, p: number, isExit: boolean) {
  switch (type) {
    case "cube-right":
      return {
        transform: `rotateY(${(isExit ? 1 : -1) * p * 90}deg) translateZ(${p * -200}px)`,
        opacity: 1 - p * 0.3,
        filter: `blur(${p * 3}px)`,
      };
    case "cube-up":
      return {
        transform: `rotateX(${(isExit ? -1 : 1) * p * 90}deg) translateZ(${p * -200}px)`,
        opacity: 1 - p * 0.3,
        filter: `blur(${p * 3}px)`,
      };
    case "zoom-through":
      return {
        transform: `translate3d(0, 0, ${(isExit ? 1 : -1) * p * 800}px) scale(${1 + p * 0.5})`,
        opacity: 1 - p,
        filter: `blur(${p * 6}px)`,
      };
    case "flip":
      return {
        transform: `perspective(1200px) rotateY(${(isExit ? 1 : -1) * p * 180}deg)`,
        opacity: 1 - p * 0.5,
        filter: undefined,
      };
    case "swirl":
      return {
        transform: `rotate(${(isExit ? 1 : -1) * p * 30}deg) scale(${1 - p * 0.3}) translate3d(0, 0, ${p * -500}px)`,
        opacity: 1 - p,
        filter: `blur(${p * 4}px)`,
      };
    case "portal":
      return {
        transform: `scale(${1 - p * 0.8}) translate3d(0, 0, ${(isExit ? -1 : 1) * p * 600}px)`,
        opacity: 1 - p,
        filter: `blur(${p * 8}px) brightness(${1 + p * 0.5})`,
      };
    default:
      return { transform: "none", opacity: 1, filter: undefined };
  }
}

// 3D entrance for individual elements
export function Entrance3D({
  children,
  delay = 0,
  duration = 10,
  from = "below",
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  from?: "below" | "above" | "left" | "right" | "far" | "spin";
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const entranceMap = {
    below: `translate3d(0, ${p * 80}px, ${p * -200}px) rotateX(${p * 15}deg)`,
    above: `translate3d(0, ${p * -80}px, ${p * -200}px) rotateX(${p * -15}deg)`,
    left: `translate3d(${p * -120}px, 0, ${p * -150}px) rotateY(${p * -20}deg)`,
    right: `translate3d(${p * 120}px, 0, ${p * -150}px) rotateY(${p * 20}deg)`,
    far: `translate3d(0, 0, ${p * -600}px) scale(${1 - p * 0.3})`,
    spin: `translate3d(0, ${p * 40}px, ${p * -300}px) rotateY(${p * 180}deg) rotateX(${p * 10}deg)`,
  };

  return (
    <div
      style={{
        perspective: 1000,
        ...style,
      }}
    >
      <div
        style={{
          transformStyle: "preserve-3d",
          transform: entranceMap[from],
          opacity: 1 - p * 0.8,
          filter: p > 0.5 ? `blur(${(p - 0.5) * 4}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
