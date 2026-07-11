import { useCurrentFrame } from "remotion";
import { theme, WIDTH, HEIGHT } from "../theme";

export function GridBackground() {
  const frame = useCurrentFrame();
  const offset = (frame * 0.3) % 60;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: WIDTH,
        height: HEIGHT,
        backgroundImage: `
          linear-gradient(${theme.border}33 1px, transparent 1px),
          linear-gradient(90deg, ${theme.border}33 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        backgroundPosition: `0 ${offset}px`,
        opacity: 0.5,
      }}
    />
  );
}
