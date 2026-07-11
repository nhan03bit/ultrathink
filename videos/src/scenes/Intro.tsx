import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { GridBackground } from "../components/GridBackground";
import { Entrance3D } from "../components/Transition3D";
import { FloatingLogo3D } from "../three/FloatingLogo";

export function Intro() {
  const frame = useCurrentFrame();
  const glowIntensity = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.3, 0.8]);

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <GridBackground />

      <AbsoluteFill
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
      >
        <Entrance3D delay={1} duration={10} from="far">
          <FloatingLogo3D />
        </Entrance3D>

        <Entrance3D delay={4} duration={8} from="below">
          <h1
            style={{
              fontSize: 96,
              fontWeight: 800,
              fontFamily: "SF Pro Display, system-ui",
              background: `linear-gradient(135deg, ${theme.text} 0%, ${theme.accentBright} 50%, ${theme.cyan} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginTop: -20,
              letterSpacing: "-2px",
              filter: `drop-shadow(0 0 ${20 * glowIntensity}px ${theme.accent}66)`,
            }}
          >
            UltraThink
          </h1>
        </Entrance3D>

        <Entrance3D delay={7} duration={8} from="below">
          <p
            style={{
              fontSize: 32,
              color: theme.textMuted,
              fontFamily: "SF Pro Display, system-ui",
              fontWeight: 400,
              marginTop: 12,
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            Workflow OS for AI Code Editors
          </p>
        </Entrance3D>

        <Entrance3D delay={10} duration={6} from="far">
          <div
            style={{
              marginTop: 40,
              padding: "8px 24px",
              borderRadius: 100,
              border: `1px solid ${theme.border}`,
              background: `${theme.bgSurface}cc`,
              fontSize: 16,
              color: theme.textDim,
              fontFamily: "SF Mono, monospace",
            }}
          >
            v1.0.0 &middot; MIT License &middot; Open Source
          </div>
        </Entrance3D>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
