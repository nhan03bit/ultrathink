import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, OSS } from "../theme";
import { GridBackground } from "../components/GridBackground";
import { CountUp } from "../components/CountUp";
import { StatsOrbs3D } from "../three/StatsOrbs";
import { Entrance3D } from "../components/Transition3D";

const stats = [
  { target: OSS.skillsNum, suffix: "+", label: "Domain Skills", color: theme.accent },
  { target: OSS.hooks, suffix: "", label: "Lifecycle Hooks", color: theme.green },
  { target: OSS.dashboardPages, suffix: "", label: "Dashboard Pages", color: theme.amber },
  { target: OSS.migrations, suffix: "", label: "DB Migrations", color: theme.cyan },
  { target: OSS.agents, suffix: "", label: "Specialized Agents", color: "#a855f7" },
  { target: OSS.layers, suffix: "", label: "Architecture Layers", color: theme.accentBright },
];

export function Stats() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <GridBackground />
      <StatsOrbs3D />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 160px",
        }}
      >
        <Entrance3D delay={0} duration={5} from="above">
          <div
            style={{
              fontSize: 16,
              fontFamily: "SF Mono, monospace",
              color: theme.accentBright,
              textTransform: "uppercase",
              letterSpacing: 4,
              marginBottom: 16,
            }}
          >
            By the Numbers
          </div>
        </Entrance3D>

        <Entrance3D delay={1} duration={6} from="far">
          <h2
            style={{
              fontSize: 48,
              fontWeight: 700,
              fontFamily: "SF Pro Display, system-ui",
              color: theme.text,
              textAlign: "center",
              marginBottom: 60,
            }}
          >
            Production-grade from{" "}
            <span
              style={{
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.cyan})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              day one
            </span>
          </h2>
        </Entrance3D>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 40,
            justifyContent: "center",
            width: "100%",
            perspective: 600,
          }}
        >
          {stats.map((s, i) => {
            const d = 4 + i * 1.5;
            const enterP = interpolate(frame, [d, d + 5], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const rotX = enterP * 30;
            const tz = enterP * -200;
            return (
              <div
                key={i}
                style={{
                  width: 260,
                  transformStyle: "preserve-3d",
                  transform: `translate3d(0, 0, ${tz}px) rotateX(${rotX}deg)`,
                  opacity: 1 - enterP * 0.9,
                }}
              >
                <CountUp
                  target={s.target}
                  suffix={s.suffix}
                  label={s.label}
                  color={s.color}
                  delay={3 + i * 1.5}
                  duration={8}
                />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
