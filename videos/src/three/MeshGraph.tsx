import { useCurrentFrame, interpolate } from "remotion";
import { theme } from "../theme";

// CSS 3D rotating skill mesh graph
interface GraphNode {
  x: number;
  y: number;
  z: number;
  color: string;
  size: number;
  label: string;
}

const nodes: GraphNode[] = [
  // Orchestrators (top)
  { x: 0, y: -180, z: 0, color: theme.accent, size: 16, label: "gsd" },
  { x: -120, y: -180, z: 40, color: theme.accent, size: 16, label: "plan" },
  { x: 120, y: -180, z: -40, color: theme.accent, size: 16, label: "cook" },
  // Hubs
  { x: -140, y: -60, z: 80, color: theme.cyan, size: 13, label: "react" },
  { x: -30, y: -60, z: -90, color: theme.cyan, size: 13, label: "debug" },
  { x: 100, y: -60, z: 60, color: theme.cyan, size: 13, label: "test" },
  { x: 160, y: -60, z: -60, color: theme.cyan, size: 13, label: "review" },
  // Utilities
  { x: -170, y: 70, z: 0, color: theme.green, size: 10, label: "refactor" },
  { x: -60, y: 70, z: 110, color: theme.green, size: 10, label: "research" },
  { x: 60, y: 70, z: -110, color: theme.green, size: 10, label: "optimize" },
  { x: 170, y: 70, z: 40, color: theme.green, size: 10, label: "scout" },
  // Domain (bottom ring)
  { x: -150, y: 190, z: 70, color: theme.amber, size: 8, label: "nextjs" },
  { x: -70, y: 190, z: -100, color: theme.amber, size: 8, label: "stripe" },
  { x: 40, y: 190, z: 130, color: theme.amber, size: 8, label: "aws" },
  { x: 120, y: 190, z: -70, color: theme.amber, size: 8, label: "drizzle" },
  { x: 190, y: 190, z: 30, color: theme.amber, size: 8, label: "tailwind" },
  { x: -40, y: 190, z: 0, color: theme.amber, size: 8, label: "postgres" },
];

const edges: [number, number][] = [
  [0, 3],
  [0, 4],
  [1, 4],
  [1, 5],
  [2, 5],
  [2, 6],
  [3, 7],
  [3, 8],
  [4, 8],
  [4, 9],
  [5, 9],
  [5, 10],
  [6, 10],
  [7, 11],
  [7, 16],
  [8, 12],
  [8, 13],
  [9, 14],
  [10, 15],
  [10, 14],
  [0, 1],
  [1, 2],
];

export function MeshGraph3D({ progress = 1 }: { progress?: number }) {
  const frame = useCurrentFrame();
  const rotY = frame * 1.2;
  const rotX = 15 + Math.sin(frame * 0.03) * 5;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        perspective: 1200,
      }}
    >
      <div
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        }}
      >
        {/* Edges */}
        {edges.map(([a, b], i) => {
          const na = nodes[a],
            nb = nodes[b];
          if (!na || !nb) return null;
          const edgeP = Math.min(1, Math.max(0, (progress - i * 0.02) * 2));
          if (edgeP <= 0) return null;

          const tx = na.x + (nb.x - na.x) * edgeP;
          const ty = na.y + (nb.y - na.y) * edgeP;
          const tz = na.z + (nb.z - na.z) * edgeP;
          const mx = (na.x + tx) / 2;
          const my = (na.y + ty) / 2;
          const mz = (na.z + tz) / 2;
          const dx = tx - na.x,
            dy = ty - na.y;
          const len = Math.sqrt(dx * dx + dy * dy + (tz - na.z) ** 2);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <div
              key={`e${i}`}
              style={{
                position: "absolute",
                width: len,
                height: 1,
                marginLeft: -len / 2,
                marginTop: -0.5,
                background: `linear-gradient(90deg, ${na.color}66, ${na.color}33)`,
                transform: `translate3d(${mx}px, ${my}px, ${mz}px) rotateZ(${angle}deg)`,
                opacity: 0.4 * edgeP,
              }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const nodeP = Math.min(1, Math.max(0, (progress - 0.05) * 2.5 - i * 0.04));
          if (nodeP <= 0) return null;
          const pulse = 1 + Math.sin(frame * 0.08 + i) * 0.15;
          const s = node.size * pulse * nodeP;

          return (
            <div
              key={`n${i}`}
              style={{
                position: "absolute",
                transform: `translate3d(${node.x}px, ${node.y}px, ${node.z}px)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Glow */}
              <div
                style={{
                  width: s * 3,
                  height: s * 3,
                  marginLeft: -s * 1.5,
                  marginTop: -s * 1.5,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${node.color}33, transparent 70%)`,
                  position: "absolute",
                }}
              />
              {/* Core */}
              <div
                style={{
                  width: s,
                  height: s,
                  marginLeft: -s / 2,
                  marginTop: -s / 2,
                  borderRadius: "50%",
                  background: node.color,
                  boxShadow: `0 0 ${8 * pulse}px ${node.color}`,
                }}
              />
              {/* Label */}
              <div
                style={{
                  position: "absolute",
                  top: s / 2 + 6,
                  fontFamily: "SF Mono, monospace",
                  fontSize: 10,
                  color: theme.textDim,
                  opacity: nodeP,
                  whiteSpace: "nowrap",
                }}
              >
                {node.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
