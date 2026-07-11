// intent: main showcase video — combines Manim clips with Remotion motion graphics.
//         Hook → Manim skill mesh → Manim pipeline → Manim memory → Manim Tekio → Stats → Harness → CTA
// status: done
// next: render after Manim clips are ready
// confidence: high

import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  staticFile,
  interpolate,
  useCurrentFrame,
  Easing,
  spring,
  useVideoConfig,
} from "remotion";
import { theme, font, motion, FPS, OSS } from "./theme";

const TOTAL_DURATION = 52; // seconds

// ─────────────────────────────────────────────────────────────
// Scene timeline
// ─────────────────────────────────────────────────────────────

interface SceneDef {
  id: string;
  start: number; // seconds
  duration: number; // seconds
  type: "remotion" | "manim";
  manim?: string; // filename in public/manim/
}

const scenes: SceneDef[] = [
  { id: "hook", start: 0, duration: 4, type: "remotion" },
  { id: "skillmesh", start: 3.5, duration: 8, type: "manim", manim: "SkillMeshGraph.mp4" },
  { id: "pipeline", start: 11, duration: 7, type: "manim", manim: "PipelineFSM.mp4" },
  { id: "memory", start: 17.5, duration: 8, type: "manim", manim: "MemoryWings.mp4" },
  { id: "tekio", start: 25, duration: 7, type: "manim", manim: "TekioWheel.mp4" },
  { id: "stats", start: 31.5, duration: 6, type: "remotion" },
  { id: "harness", start: 37, duration: 7, type: "remotion" },
  { id: "cta", start: 43.5, duration: 8.5, type: "remotion" },
];

// ─────────────────────────────────────────────────────────────
// Ambient grid background — subtle dot grid with slow drift
// ─────────────────────────────────────────────────────────────

function AmbientGrid() {
  const frame = useCurrentFrame();
  const drift = frame * 0.15;
  const dotColor = `${theme.accent}12`;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        backgroundPosition: `${drift}px ${drift * 0.5}px`,
        pointerEvents: "none",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Transition wrapper — fade in/out for Remotion-native scenes
// ─────────────────────────────────────────────────────────────

function SceneWrapper({ children, durationFrames }: { children: React.ReactNode; durationFrames: number }) {
  const frame = useCurrentFrame();
  const { fadeFrames } = motion;

  const fadeIn = interpolate(frame, [0, fadeFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const fadeOut = interpolate(frame, [durationFrames - fadeFrames, durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const scale = interpolate(frame, [0, 12], [1.03, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(fadeIn, fadeOut),
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// ─────────────────────────────────────────────────────────────
// Manim clip wrapper — NO SceneWrapper (Manim has own transitions)
// Only adds vignette glow overlay, no double-fade
// ─────────────────────────────────────────────────────────────

function ManimClip({ file, durationFrames }: { file: string; durationFrames: number }) {
  const frame = useCurrentFrame();

  // Simple cross-fade at boundaries — no SceneWrapper
  const opacity = interpolate(
    frame,
    [0, motion.fadeFrames, durationFrames - motion.fadeFrames, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const glowOpacity = interpolate(frame, [0, 20, durationFrames - 20, durationFrames], [0, 0.4, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, background: theme.bg }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: `inset 0 0 120px 40px ${theme.accentGlow}30`,
          opacity: glowOpacity,
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
      <OffthreadVideo
        src={staticFile(`manim/${file}`)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </AbsoluteFill>
  );
}

// ─────────────────────────────────────────────────────────────
// CSS hexagon shape (replaces emoji)
// ─────────────────────────────────────────────────────────────

function HexLogo({ size, glowIntensity = 1 }: { size: number; glowIntensity?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size * 1.15,
        position: "relative",
        filter: `drop-shadow(0 0 ${20 * glowIntensity}px ${theme.accent})`,
      }}
    >
      <svg viewBox="0 0 100 115" width={size} height={size * 1.15}>
        <polygon
          points="50,0 100,28.75 100,86.25 50,115 0,86.25 0,28.75"
          fill="none"
          stroke={theme.accent}
          strokeWidth="3"
        />
        <polygon
          points="50,10 90,33.75 90,81.25 50,105 10,81.25 10,33.75"
          fill={`${theme.accentGlow}30`}
          stroke={theme.accentBright}
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook scene — dramatic opening
// ─────────────────────────────────────────────────────────────

function HookScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = FPS * 4;

  const titleSpring = spring({ frame, fps, config: motion.springDefault });
  const subDelay = 20;
  const subSpring = spring({ frame: frame - subDelay, fps, config: motion.springGentle });

  // Hex settles to rest — NOT continuous rotation
  const hexRotation = interpolate(frame, [0, 40], [15, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const glowPulse = Math.sin(frame * 0.08) * 0.3 + 0.7;

  return (
    <SceneWrapper durationFrames={durationFrames}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${theme.accentGlow}30, ${theme.bg})`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <AmbientGrid />

        <div
          style={{
            opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" }),
            transform: `scale(${titleSpring}) rotate(${hexRotation}deg)`,
            marginBottom: 30,
          }}
        >
          <HexLogo size={90} glowIntensity={glowPulse} />
        </div>

        <div
          style={{
            fontSize: font.size.xxl,
            fontFamily: font.display,
            fontWeight: font.weight.bold,
            color: theme.text,
            transform: `translateY(${(1 - titleSpring) * 40}px)`,
            opacity: titleSpring,
            textShadow: `0 0 40px ${theme.accentGlow}80`,
          }}
        >
          UltraThink
        </div>

        <div
          style={{
            fontSize: font.size.md,
            fontFamily: font.display,
            color: theme.textMuted,
            transform: `translateY(${(1 - Math.max(0, subSpring)) * 30}px)`,
            opacity: Math.max(0, subSpring),
            marginTop: 16,
            letterSpacing: 2,
          }}
        >
          Your AI&apos;s Operating System
        </div>
      </AbsoluteFill>
    </SceneWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// Stats scene — animated counters
// ─────────────────────────────────────────────────────────────

function CountUp({ target, suffix = "", delay = 0 }: { target: number; suffix?: string; delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prog = spring({ frame: frame - delay, fps, config: motion.springGentle });
  const value = Math.round(target * Math.max(0, prog));
  return (
    <>
      {value}
      {suffix}
    </>
  );
}

function StatsScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = FPS * 6;
  const staggerDelay = 8;

  const stats = [
    { label: "Skills", value: OSS.skillsNum, suffix: "", color: theme.accent },
    { label: "Layers", value: OSS.layers, suffix: "", color: theme.cyan },
    { label: "Categories", value: OSS.categories, suffix: "", color: theme.green },
    { label: "LongMemEval", value: OSS.memEval, suffix: "%", color: theme.amber },
    { label: "Tekio Spins", value: -1, suffix: "", color: theme.accentBright },
  ];

  return (
    <SceneWrapper durationFrames={durationFrames}>
      <AbsoluteFill
        style={{
          background: theme.bg,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
        }}
      >
        <AmbientGrid />

        <div
          style={{
            fontSize: font.size.xl,
            fontFamily: font.display,
            fontWeight: font.weight.semibold,
            color: theme.text,
            marginBottom: 40,
            opacity: interpolate(frame, [0, motion.fadeFrames], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          By the Numbers
        </div>

        <div style={{ display: "flex", gap: 60, flexWrap: "wrap", justifyContent: "center" }}>
          {stats.map((s, i) => {
            const delay = i * staggerDelay;
            const prog = spring({ frame: frame - delay, fps, config: motion.springDefault });
            return (
              <div
                key={s.label}
                style={{
                  textAlign: "center",
                  transform: `translateY(${(1 - Math.max(0, prog)) * 30}px)`,
                  opacity: Math.max(0, prog),
                }}
              >
                <div
                  style={{
                    fontSize: 64,
                    fontFamily: font.mono,
                    fontWeight: font.weight.bold,
                    color: s.color,
                    textShadow: `0 0 30px ${s.color}60`,
                  }}
                >
                  {s.value === -1 ? (
                    <span style={{ fontFamily: font.display }}>infinity</span>
                  ) : (
                    <CountUp target={s.value} suffix={s.suffix} delay={delay} />
                  )}
                </div>
                <div
                  style={{
                    fontSize: font.size.sm,
                    fontFamily: font.display,
                    color: theme.textMuted,
                    marginTop: 8,
                  }}
                >
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// Harness scene — the TUI pipeline
// ─────────────────────────────────────────────────────────────

function HarnessScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = FPS * 7;
  const phaseStagger = 15;

  const phases = [
    { label: "Pick intent", icon: ">", color: theme.cyan },
    { label: "AI executes", icon: "//", color: theme.accent },
    { label: "You approve", icon: "ok", color: theme.green },
    { label: "Ship it", icon: "^", color: theme.amber },
  ];

  return (
    <SceneWrapper durationFrames={durationFrames}>
      <AbsoluteFill
        style={{
          background: theme.bg,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <AmbientGrid />

        <div
          style={{
            fontSize: font.size.xl,
            fontFamily: font.display,
            fontWeight: font.weight.semibold,
            color: theme.text,
            marginBottom: 12,
            opacity: interpolate(frame, [0, motion.fadeFrames], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          No Commands. Only Intentions.
        </div>
        <div
          style={{
            fontSize: font.size.sm,
            fontFamily: font.display,
            color: theme.textMuted,
            marginBottom: 60,
            opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          The Harness TUI controls AI workers through a fixed pipeline
        </div>

        <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
          {phases.map((p, i) => {
            const delay = phaseStagger + i * phaseStagger;
            const prog = spring({ frame: frame - delay, fps, config: motion.springSnappy });
            return (
              <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 40 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    transform: `scale(${Math.max(0, prog)}) translateY(${(1 - Math.max(0, prog)) * 20}px)`,
                    opacity: Math.max(0, prog),
                  }}
                >
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 16,
                      background: `${p.color}15`,
                      border: `2px solid ${p.color}`,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      fontSize: font.size.lg,
                      fontFamily: font.mono,
                      fontWeight: font.weight.bold,
                      color: p.color,
                      boxShadow: `0 0 20px ${p.color}30`,
                    }}
                  >
                    {p.icon}
                  </div>
                  <div
                    style={{
                      fontSize: font.size.sm,
                      fontFamily: font.display,
                      color: p.color,
                      fontWeight: font.weight.medium,
                    }}
                  >
                    {p.label}
                  </div>
                </div>
                {i < phases.length - 1 && (
                  <div
                    style={{
                      fontSize: font.size.md,
                      color: theme.textDim,
                      fontFamily: font.mono,
                      opacity: interpolate(frame, [delay + 10, delay + 18], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
                    }}
                  >
                    {">"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Feedback loop actions */}
        <div
          style={{
            marginTop: 50,
            display: "flex",
            gap: 24,
            opacity: interpolate(frame, [90, 105], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {["redo", "modify", "improve", "feedback"].map((action) => (
            <div
              key={action}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: `1px solid ${theme.accentGlow}`,
                color: theme.accentBright,
                fontFamily: font.mono,
                fontSize: font.size.sm,
              }}
            >
              {action}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </SceneWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// CTA scene — closing
// ─────────────────────────────────────────────────────────────

function CTAScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durationFrames = Math.round(FPS * 8.5);

  const logoSpring = spring({ frame, fps, config: motion.springSnappy });
  const glowPulse = Math.sin(frame * 0.06) * 0.4 + 0.6;

  // Hex settles, doesn't spin forever
  const hexRotation = interpolate(frame, [0, 50], [20, 0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const tags = [`${OSS.skillsNum} Skills`, `${OSS.layers} Layers`, "Infinite Adaptations", `${OSS.memEval}% Recall`];

  return (
    <SceneWrapper durationFrames={durationFrames}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${theme.accentGlow}25, ${theme.bg})`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <AmbientGrid />

        <div
          style={{
            transform: `scale(${logoSpring}) rotate(${hexRotation}deg)`,
            marginBottom: 30,
          }}
        >
          <HexLogo size={110} glowIntensity={glowPulse} />
        </div>

        <div
          style={{
            fontSize: 56,
            fontFamily: font.display,
            fontWeight: font.weight.bold,
            color: theme.text,
            opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }),
            textShadow: `0 0 60px ${theme.accentGlow}50`,
          }}
        >
          Build with UltraThink
        </div>

        <div
          style={{
            fontSize: font.size.md,
            fontFamily: font.mono,
            color: theme.accent,
            marginTop: 20,
            opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {OSS.github}
        </div>

        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 50,
            opacity: interpolate(frame, [45, 60], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {tags.map((tag, i) => {
            const delay = 50 + i * 8;
            const prog = spring({ frame: frame - delay, fps, config: motion.springDefault });
            return (
              <div
                key={tag}
                style={{
                  padding: "10px 24px",
                  borderRadius: 12,
                  background: `${theme.accent}15`,
                  border: `1px solid ${theme.accent}40`,
                  color: theme.accentBright,
                  fontFamily: font.display,
                  fontSize: font.size.sm,
                  fontWeight: font.weight.medium,
                  transform: `scale(${Math.max(0, prog)})`,
                  opacity: Math.max(0, prog),
                }}
              >
                {tag}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// Main composition
// ─────────────────────────────────────────────────────────────

function getSceneComponent(scene: SceneDef, durationFrames: number) {
  switch (scene.id) {
    case "hook":
      return <HookScene />;
    case "stats":
      return <StatsScene />;
    case "harness":
      return <HarnessScene />;
    case "cta":
      return <CTAScene />;
    default:
      if (scene.type === "manim" && scene.manim) {
        return <ManimClip file={scene.manim} durationFrames={durationFrames} />;
      }
      return null;
  }
}

export function UltraThinkShowcase() {
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {scenes.map((scene) => {
        const startFrame = Math.round(scene.start * FPS);
        const durationFrames = Math.round(scene.duration * FPS);
        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={durationFrames} name={scene.id}>
            {getSceneComponent(scene, durationFrames)}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
