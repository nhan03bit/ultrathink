// UltraThink brand colors and design tokens
export const theme = {
  bg: "#0a0a0f",
  bgSurface: "#12121a",
  bgSurface2: "#1a1a26",
  accent: "#6366f1",
  accentBright: "#818cf8",
  accentGlow: "#4f46e5",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  cyan: "#06b6d4",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  border: "#1e293b",
} as const;

// Typography
export const font = {
  display: "Inter, SF Pro Display, system-ui, sans-serif",
  mono: "JetBrains Mono, SF Mono, monospace",
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700 } as const,
  // Minimum sizes for 1080p video readability
  size: { xs: 16, sm: 20, md: 26, lg: 36, xl: 48, xxl: 72 } as const,
} as const;

// Animation tokens
export const motion = {
  fadeFrames: 18,
  staggerMs: 100, // 50-200ms between staggered elements
  springDefault: { damping: 14, stiffness: 80 } as const,
  springGentle: { damping: 20, stiffness: 40 } as const,
  springSnappy: { damping: 10, stiffness: 120 } as const,
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Stats (single source of truth)
export const OSS = {
  skills: "232+",
  skillsNum: 232,
  categories: 50,
  hooks: 24,
  agents: 10,
  commands: 8,
  migrations: 11,
  dashboardPages: 13,
  layers: 4,
  memEval: 100,
  github: "github.com/InugamiDev/ultrathink-oss",
  editors: ["Claude Code", "Cursor", "Windsurf", "Antigravity", "GitHub Copilot"],
} as const;
