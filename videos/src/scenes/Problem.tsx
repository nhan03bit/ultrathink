import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { theme } from "../theme";
import { GlowOrb } from "../components/GlowOrb";
import { GridBackground } from "../components/GridBackground";
import { Entrance3D } from "../components/Transition3D";

const problems = [
  { icon: "🧠", text: "AI assistants forget everything between sessions" },
  { icon: "🔓", text: "No protection for sensitive files & credentials" },
  { icon: "🎯", text: "Skills don't activate based on context" },
  { icon: "👁", text: "Zero visibility into assistant activity" },
];

export function Problem() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <GridBackground />
      <GlowOrb x={300} y={540} size={500} color="#ef444444" pulseSpeed={0.04} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 200px",
        }}
      >
        <Entrance3D delay={0} duration={5} from="above">
          <div
            style={{
              fontSize: 16,
              fontFamily: "SF Mono, monospace",
              color: theme.red,
              textTransform: "uppercase",
              letterSpacing: 4,
              marginBottom: 16,
            }}
          >
            The Problem
          </div>
        </Entrance3D>

        <Entrance3D delay={1} duration={6} from="spin">
          <h2
            style={{
              fontSize: 64,
              fontWeight: 700,
              fontFamily: "SF Pro Display, system-ui",
              color: theme.text,
              textAlign: "center",
              marginBottom: 48,
              lineHeight: 1.2,
            }}
          >
            Stateless AI is <span style={{ color: theme.red }}>broken</span>
          </h2>
        </Entrance3D>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
          {problems.map((p, i) => {
            const from = (["left", "right", "left", "right"] as const)[i];
            return (
              <Entrance3D key={i} delay={4 + i * 3} duration={5} from={from}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    padding: "16px 28px",
                    borderRadius: 16,
                    background: `${theme.bgSurface}cc`,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <span style={{ fontSize: 32 }}>{p.icon}</span>
                  <span style={{ fontSize: 24, color: theme.textMuted, fontFamily: "SF Pro Display, system-ui" }}>
                    {p.text}
                  </span>
                </div>
              </Entrance3D>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
