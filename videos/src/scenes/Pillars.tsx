import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, OSS } from "../theme";
import { GlowOrb } from "../components/GlowOrb";
import { GridBackground } from "../components/GridBackground";
import { Entrance3D } from "../components/Transition3D";

const pillars = [
  { title: "Skills", count: OSS.skills, desc: "4-layer mesh, auto-activates on intent", color: theme.accent },
  { title: "Memory", count: "Persistent", desc: "Postgres-backed semantic search", color: theme.cyan },
  { title: "Hooks", count: `${OSS.hooks}`, desc: "Privacy guards & lifecycle automation", color: theme.green },
  {
    title: "Dashboard",
    count: `${OSS.dashboardPages} Pages`,
    desc: "Full observability & real-time insights",
    color: theme.amber,
  },
];

export function Pillars() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <GridBackground />
      <GlowOrb x={960} y={540} size={700} color={theme.accent} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 120px",
        }}
      >
        <Entrance3D delay={0} duration={5} from="above">
          <div
            style={{
              fontSize: 16,
              fontFamily: "SF Mono, monospace",
              color: theme.accent,
              textTransform: "uppercase",
              letterSpacing: 4,
              marginBottom: 16,
            }}
          >
            The Solution
          </div>
        </Entrance3D>

        <Entrance3D delay={1} duration={6} from="far">
          <h2
            style={{
              fontSize: 56,
              fontWeight: 700,
              fontFamily: "SF Pro Display, system-ui",
              color: theme.text,
              textAlign: "center",
              marginBottom: 48,
            }}
          >
            Four pillars of{" "}
            <span
              style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.cyan})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              intelligence
            </span>
          </h2>
        </Entrance3D>

        <div style={{ display: "flex", gap: 24, width: "100%", perspective: 800 }}>
          {pillars.map((p, i) => {
            const d = 5 + i * 3;
            const enterP = interpolate(frame, [d, d + 8], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const glow = 0.5 + Math.sin(frame * 0.08 + i) * 0.3;
            // Each card flies in from a different 3D angle
            const rotY = enterP * (i % 2 === 0 ? -30 : 30);
            const tz = enterP * -300;
            const ty = enterP * 60;

            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  transformStyle: "preserve-3d",
                  transform: `translate3d(0, ${ty}px, ${tz}px) rotateY(${rotY}deg)`,
                  opacity: 1 - enterP * 0.8,
                  padding: "32px 24px",
                  borderRadius: 20,
                  background: `${theme.bgSurface}ee`,
                  border: `1px solid ${p.color}33`,
                  boxShadow: `0 0 ${30 * glow}px ${p.color}15`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: p.color, fontFamily: "SF Pro Display, system-ui" }}>
                  {p.count}
                </div>
                <div
                  style={{ fontSize: 22, fontWeight: 600, color: theme.text, fontFamily: "SF Pro Display, system-ui" }}
                >
                  {p.title}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    color: theme.textDim,
                    fontFamily: "SF Pro Display, system-ui",
                    lineHeight: 1.5,
                  }}
                >
                  {p.desc}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
