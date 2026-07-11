import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { GlowOrb } from "../components/GlowOrb";
import { GridBackground } from "../components/GridBackground";
import { Entrance3D } from "../components/Transition3D";

const memories = [
  { category: "architecture", importance: 9, text: "Use server components for data fetching" },
  { category: "preference", importance: 8, text: "Prefer Drizzle over Prisma for type safety" },
  { category: "solution", importance: 10, text: "Fixed auth race condition with mutex lock" },
  { category: "pattern", importance: 7, text: "Always use zod for API input validation" },
];

const categoryColors: Record<string, string> = {
  architecture: theme.accent,
  preference: theme.cyan,
  solution: theme.green,
  pattern: theme.amber,
};

export function MemoryDemo() {
  const frame = useCurrentFrame();
  const query = "auth patterns";
  const typedChars = Math.min(
    query.length,
    Math.floor(interpolate(frame, [3, 11], [0, query.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
  );
  const showCursor = frame % 12 < 8;

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <GridBackground />
      <GlowOrb x={500} y={400} size={500} color={theme.cyan} />

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
              color: theme.cyan,
              textTransform: "uppercase",
              letterSpacing: 4,
              marginBottom: 16,
            }}
          >
            Persistent Memory
          </div>
        </Entrance3D>

        <Entrance3D delay={1} duration={6} from="far">
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
            Your AI <span style={{ color: theme.cyan }}>remembers</span>
          </h2>
        </Entrance3D>

        <Entrance3D delay={2} duration={5} from="below" style={{ width: "100%", maxWidth: 800 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 24px",
              borderRadius: 16,
              background: theme.bgSurface,
              border: `1px solid ${theme.border}`,
              marginBottom: 24,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke={theme.textDim} strokeWidth="2" />
              <line x1="13.5" y1="13.5" x2="18" y2="18" stroke={theme.textDim} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: "SF Mono, monospace", fontSize: 18, color: theme.text }}>
              {query.slice(0, typedChars)}
              {showCursor && <span style={{ color: theme.accent }}>|</span>}
            </span>
            <div style={{ marginLeft: "auto", fontSize: 12, color: theme.textDim, fontFamily: "SF Mono, monospace" }}>
              tsvector + trigram + ILIKE
            </div>
          </div>
        </Entrance3D>

        <div
          style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 800, perspective: 600 }}
        >
          {memories.map((m, i) => {
            const d = 9 + i * 2;
            const enterP = interpolate(frame, [d, d + 5], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const c = categoryColors[m.category] || theme.textDim;
            // Cards fly in from the right with 3D rotation
            const rotY = enterP * -25;
            const tx = enterP * 150;
            const tz = enterP * -200;

            return (
              <div
                key={i}
                style={{
                  transformStyle: "preserve-3d",
                  transform: `translate3d(${tx}px, 0, ${tz}px) rotateY(${rotY}deg)`,
                  opacity: 1 - enterP * 0.9,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 18px",
                  borderRadius: 12,
                  background: `${theme.bgSurface2}cc`,
                  border: `1px solid ${theme.border}`,
                  borderLeft: `3px solid ${c}`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "SF Mono, monospace",
                    color: c,
                    textTransform: "uppercase",
                    background: `${c}15`,
                    padding: "3px 8px",
                    borderRadius: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.category}
                </div>
                <div style={{ flex: 1, fontSize: 16, color: theme.textMuted, fontFamily: "SF Pro Display, system-ui" }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 13, fontFamily: "SF Mono, monospace", color: theme.textDim }}>
                  imp:{m.importance}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
