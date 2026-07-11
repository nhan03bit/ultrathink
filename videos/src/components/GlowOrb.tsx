import { interpolate, useCurrentFrame } from "remotion";

export function GlowOrb({
  x,
  y,
  size = 400,
  color = "#6366f1",
  pulseSpeed = 0.02,
}: {
  x: number;
  y: number;
  size?: number;
  color?: string;
  pulseSpeed?: number;
}) {
  const frame = useCurrentFrame();
  const scale = 1 + Math.sin(frame * pulseSpeed) * 0.15;
  const opacity = interpolate(Math.sin(frame * pulseSpeed * 0.7), [-1, 1], [0.15, 0.35]);

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
        transform: `scale(${scale})`,
        opacity,
        filter: `blur(${size * 0.15}px)`,
        pointerEvents: "none",
      }}
    />
  );
}
