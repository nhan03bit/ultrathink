import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { GlowOrb } from "../components/GlowOrb";
import { GridBackground } from "../components/GridBackground";
import { Entrance3D } from "../components/Transition3D";

const editors = [
  {
    name: "Claude Code",
    features: ["Skills", "Memory", "Hooks", "Dashboard", "Agents"],
    level: "Full",
    color: theme.accent,
  },
  { name: "Cursor", features: ["Skills (read)", "Dashboard"], level: "Compatible", color: theme.cyan },
  { name: "Windsurf", features: ["Skills (read)", "Dashboard"], level: "Compatible", color: theme.green },
  { name: "Antigravity", features: ["Skills (read)", "Dashboard"], level: "Compatible", color: "#a855f7" },
  { name: "Copilot", features: ["Dashboard"], level: "Partial", color: theme.amber },
];

export function EditorSupport() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <GridBackground />
      <GlowOrb x={960} y={540} size={600} color={theme.accent} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 100px",
        }}
      >
        <Entrance3D delay={0} duration={5} from="above">
          <div
            style={{
              fontSize: 16,
              fontFamily: "SF Mono, monospace",
              color: theme.cyan,
              textTransform: "uppercase",
              letterSpacing: 4,
              marginBottom: 16,
            }}
          >
            Compatibility
          </div>
        </Entrance3D>

        <Entrance3D delay={1} duration={6} from="spin">
          <h2
            style={{
              fontSize: 48,
              fontWeight: 700,
              fontFamily: "SF Pro Display, system-ui",
              color: theme.text,
              textAlign: "center",
              marginBottom: 40,
            }}
          >
            Works with your <span style={{ color: theme.cyan }}>editor</span>
          </h2>
        </Entrance3D>

        <div style={{ display: "flex", gap: 18, width: "100%", perspective: 800 }}>
          {editors.map((editor, i) => {
            const d = 4 + i * 2;
            const enterP = interpolate(frame, [d, d + 6], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isFull = editor.level === "Full";
            const rotY = enterP * (i % 2 === 0 ? -25 : 25);
            const tz = enterP * -250;
            const ty = enterP * 40;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  padding: "24px 18px",
                  borderRadius: 18,
                  transformStyle: "preserve-3d",
                  transform: `translate3d(0, ${ty}px, ${tz}px) rotateY(${rotY}deg)`,
                  opacity: 1 - enterP * 0.85,
                  background: `${theme.bgSurface}ee`,
                  border: `1px solid ${isFull ? editor.color : theme.border}`,
                  boxShadow: isFull ? `0 0 30px ${editor.color}20` : "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: editor.color,
                    fontFamily: "SF Pro Display, system-ui",
                  }}
                >
                  {editor.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: "SF Mono, monospace",
                    color: isFull ? editor.color : theme.textDim,
                    background: `${editor.color}15`,
                    padding: "3px 10px",
                    borderRadius: 8,
                    textTransform: "uppercase",
                  }}
                >
                  {editor.level}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                  {editor.features.map((feat, fi) => (
                    <div
                      key={fi}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        color: theme.textMuted,
                        fontFamily: "SF Pro Display, system-ui",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M3 7 L6 10 L11 4"
                          stroke={editor.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {feat}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
