import { interpolate, useCurrentFrame } from "remotion";
import type { CSSProperties, ReactNode } from "react";

export function FadeIn({
  children,
  delay = 0,
  duration = 15,
  direction = "up",
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const offsets = { up: [30, 0], down: [-30, 0], left: [30, 0], right: [-30, 0], none: [0, 0] };
  const [from, to] = offsets[direction];
  const translate = interpolate(frame, [delay, delay + duration], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const axis = direction === "left" || direction === "right" ? "X" : "Y";
  const transform = direction === "none" ? undefined : `translate${axis}(${translate}px)`;

  return <div style={{ opacity, transform, ...style }}>{children}</div>;
}
