import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { GridBackground } from "../components/GridBackground";
import { FadeIn } from "../components/FadeIn";
import { MeshGraph3D } from "../three/MeshGraph";

const layers = [
  { name: "Orchestrators", count: 8, color: theme.accent },
  { name: "Hubs", count: 18, color: theme.cyan },
  { name: "Utilities", count: 35, color: theme.green },
  { name: "Domain Specialists", count: "64+", color: theme.amber },
];

export function SkillMesh() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [4, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <GridBackground />

      {/* 3D rotating skill mesh */}
      <MeshGraph3D progress={progress} />

      {/* Title overlay */}
      <FadeIn delay={0} duration={3} style={{ position: "absolute", top: 50, width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontSize: 16,
            fontFamily: "SF Mono, monospace",
            color: theme.accent,
            textTransform: "uppercase",
            letterSpacing: 4,
            marginBottom: 12,
          }}
        >
          Architecture
        </div>
        <h2 style={{ fontSize: 48, fontWeight: 700, fontFamily: "SF Pro Display, system-ui", color: theme.text }}>
          4-Layer Skill Mesh
        </h2>
      </FadeIn>

      {/* Layer legend - left side */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {layers.map((layer, i) => {
          const d = 4 + i * 2;
          const opacity = interpolate(frame, [d, d + 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div key={i} style={{ opacity, display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: layer.color,
                  boxShadow: `0 0 12px ${layer.color}`,
                }}
              />
              <div style={{ fontFamily: "SF Pro Display, system-ui", fontSize: 16, color: theme.textMuted }}>
                {layer.name}
              </div>
              <div
                style={{
                  fontFamily: "SF Mono, monospace",
                  fontSize: 13,
                  color: layer.color,
                  background: `${layer.color}15`,
                  padding: "2px 10px",
                  borderRadius: 8,
                }}
              >
                {layer.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom caption */}
      <FadeIn delay={11} duration={4} style={{ position: "absolute", bottom: 50, width: "100%", textAlign: "center" }}>
        <p style={{ fontSize: 22, color: theme.textMuted, fontFamily: "SF Pro Display, system-ui" }}>
          Auto-trigger via intent detection &middot; Graph traversal in {"<"}30ms
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
}
