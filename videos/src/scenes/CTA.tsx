import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme, OSS } from "../theme";
import { GridBackground } from "../components/GridBackground";
import { FloatingLogo3D } from "../three/FloatingLogo";
import { Entrance3D } from "../components/Transition3D";

export function CTA() {
  const frame = useCurrentFrame();
  const glowPulse = 0.5 + Math.sin(frame * 0.08) * 0.3;

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <GridBackground />

      <AbsoluteFill
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
      >
        <Entrance3D delay={0} duration={8} from="far">
          <div style={{ marginTop: -40 }}>
            <FloatingLogo3D />
          </div>
        </Entrance3D>

        <Entrance3D delay={2} duration={8} from="below">
          <h1
            style={{
              fontSize: 80,
              fontWeight: 800,
              fontFamily: "SF Pro Display, system-ui",
              background: `linear-gradient(135deg, ${theme.text} 0%, ${theme.accentBright} 50%, ${theme.cyan} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginTop: -30,
              letterSpacing: "-2px",
              filter: `drop-shadow(0 0 ${20 * glowPulse}px ${theme.accent}66)`,
            }}
          >
            UltraThink
          </h1>
        </Entrance3D>

        <Entrance3D delay={4} duration={6} from="spin">
          <p
            style={{
              fontSize: 26,
              color: theme.textMuted,
              fontFamily: "SF Pro Display, system-ui",
              marginTop: 8,
              textAlign: "center",
              maxWidth: 700,
              lineHeight: 1.5,
            }}
          >
            Transform your AI code editor into a persistent, skill-aware intelligent agent.
          </p>
        </Entrance3D>

        <Entrance3D delay={7} duration={6} from="below">
          <div
            style={{
              marginTop: 40,
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 36px",
              borderRadius: 16,
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentGlow})`,
              boxShadow: `0 0 40px ${theme.accent}40`,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span style={{ fontSize: 20, fontWeight: 600, color: "white", fontFamily: "SF Pro Display, system-ui" }}>
              {OSS.github}
            </span>
          </div>
        </Entrance3D>

        <Entrance3D delay={10} duration={5} from="above">
          <div style={{ marginTop: 28, display: "flex", gap: 20 }}>
            {["MIT License", "TypeScript", `${OSS.skills} Skills`, "Open Source"].map((badge, i) => (
              <div
                key={i}
                style={{
                  padding: "5px 14px",
                  borderRadius: 100,
                  border: `1px solid ${theme.border}`,
                  background: `${theme.bgSurface}cc`,
                  fontSize: 13,
                  color: theme.textDim,
                  fontFamily: "SF Mono, monospace",
                }}
              >
                {badge}
              </div>
            ))}
          </div>
        </Entrance3D>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
