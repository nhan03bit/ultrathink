import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

export function CountUp({
  target,
  suffix = "",
  prefix = "",
  delay = 0,
  duration = 30,
  label,
  color = theme.accent,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  delay?: number;
  duration?: number;
  label: string;
  color?: string;
}) {
  const frame = useCurrentFrame();
  const value = Math.round(
    interpolate(frame, [delay, delay + duration], [0, target], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ textAlign: "center", opacity }}>
      <div style={{ fontSize: 72, fontWeight: 800, color, fontFamily: "SF Pro Display, system-ui" }}>
        {prefix}
        {value}
        {suffix}
      </div>
      <div style={{ fontSize: 24, color: theme.textMuted, marginTop: 8, fontFamily: "SF Pro Display, system-ui" }}>
        {label}
      </div>
    </div>
  );
}
