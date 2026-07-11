import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { GlowOrb } from "../components/GlowOrb";
import { GridBackground } from "../components/GridBackground";
import { Entrance3D } from "../components/Transition3D";

const hookEvents = [
  { event: "SessionStart", hook: "memory-session-start.sh", status: "ok", detail: "Recalled 12 memories" },
  { event: "PromptSubmit", hook: "prompt-analyzer.ts", status: "ok", detail: "Matched: react, nextjs, tailwind" },
  { event: "PreToolUse", hook: "privacy-hook.sh", status: "blocked", detail: "Blocked read: .env.local" },
  { event: "PostToolUse", hook: "post-edit-quality.sh", status: "ok", detail: "Formatted 3 files" },
  { event: "PreToolUse", hook: "privacy-hook.sh", status: "blocked", detail: "Blocked read: secrets/api-keys.json" },
];

export function HooksPrivacy() {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <GridBackground />
      <GlowOrb x={300} y={300} size={400} color={theme.green} />
      <GlowOrb x={1600} y={700} size={350} color={theme.red} pulseSpeed={0.04} />

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
              color: theme.green,
              textTransform: "uppercase",
              letterSpacing: 4,
              marginBottom: 16,
            }}
          >
            Hooks & Privacy
          </div>
        </Entrance3D>

        <Entrance3D delay={1} duration={6} from="spin">
          <h2
            style={{
              fontSize: 52,
              fontWeight: 700,
              fontFamily: "SF Pro Display, system-ui",
              color: theme.text,
              textAlign: "center",
              marginBottom: 36,
            }}
          >
            24 lifecycle hooks. <span style={{ color: theme.green }}>Zero</span> credential leaks.
          </h2>
        </Entrance3D>

        <Entrance3D delay={3} duration={6} from="below">
          <div
            style={{
              width: "100%",
              maxWidth: 1000,
              borderRadius: 16,
              overflow: "hidden",
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                background: theme.bgSurface,
                borderBottom: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.red }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.amber }} />
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.green }} />
              <span style={{ marginLeft: 12, fontFamily: "SF Mono, monospace", fontSize: 13, color: theme.textDim }}>
                hook-events.log
              </span>
            </div>

            <div style={{ padding: "12px 20px", background: `${theme.bg}ee` }}>
              {hookEvents.map((evt, i) => {
                const d = 6 + i * 2.5;
                const opacity = interpolate(frame, [d, d + 2], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const isBlocked = evt.status === "blocked";
                const flash = isBlocked
                  ? interpolate(frame, [d, d + 1, d + 3], [0, 0.15, 0], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })
                  : 0;
                // Rows slide in from left with slight 3D tilt
                const tx = interpolate(frame, [d, d + 3], [-60, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });

                return (
                  <div
                    key={i}
                    style={{
                      opacity,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "6px 8px",
                      fontFamily: "SF Mono, monospace",
                      fontSize: 14,
                      transform: `translateX(${tx}px)`,
                      background: isBlocked
                        ? `${theme.red}${Math.round(flash * 255)
                            .toString(16)
                            .padStart(2, "0")}`
                        : "transparent",
                      borderRadius: 4,
                    }}
                  >
                    <span style={{ color: theme.textDim, width: 110 }}>{evt.event}</span>
                    <span style={{ color: theme.accentBright, width: 210 }}>{evt.hook}</span>
                    <span style={{ color: isBlocked ? theme.red : theme.green, fontWeight: 600, width: 70 }}>
                      {isBlocked ? "BLOCKED" : "OK"}
                    </span>
                    <span style={{ color: isBlocked ? theme.red : theme.textMuted }}>{evt.detail}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Entrance3D>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
