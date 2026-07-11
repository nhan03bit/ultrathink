import { useCurrentFrame, interpolate } from "remotion";
import { theme } from "../theme";

// CSS 3D rotating icosahedron-inspired logo
export function FloatingLogo3D() {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rotY = frame * 2;
  const rotX = 20 + Math.sin(frame * 0.05) * 10;
  const glowPulse = 0.4 + Math.sin(frame * 0.08) * 0.3;

  const size = 160;
  const nodes = [
    { x: 0, y: -50, z: 0 },
    { x: -45, y: -15, z: 30 },
    { x: 45, y: -15, z: 30 },
    { x: 45, y: -15, z: -30 },
    { x: -45, y: -15, z: -30 },
    { x: 0, y: 35, z: 0 },
  ];

  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 1],
    [1, 5],
    [2, 5],
    [3, 5],
    [4, 5],
  ];

  return (
    <div
      style={{
        width: size,
        height: size,
        perspective: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        }}
      >
        {/* Center glow */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 80,
            height: 80,
            marginLeft: -40,
            marginTop: -40,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${theme.accent}66, transparent 70%)`,
            filter: `blur(15px)`,
            opacity: glowPulse,
          }}
        />

        {/* Nodes */}
        {nodes.map((n, i) => (
          <div
            key={`n${i}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 14,
              height: 14,
              marginLeft: -7,
              marginTop: -7,
              borderRadius: "50%",
              background: i === 0 || i === 5 ? theme.accentBright : theme.accent,
              boxShadow: `0 0 ${12 + glowPulse * 8}px ${theme.accent}`,
              transform: `translate3d(${n.x}px, ${n.y}px, ${n.z}px)`,
            }}
          />
        ))}

        {/* Edge SVGs - we use absolute positioned lines */}
        {edges.map(([a, b], i) => {
          const na = nodes[a],
            nb = nodes[b];
          // Project edges as colored bars between node positions
          const mx = (na.x + nb.x) / 2;
          const my = (na.y + nb.y) / 2;
          const mz = (na.z + nb.z) / 2;
          const dx = nb.x - na.x,
            dy = nb.y - na.y,
            dz = nb.z - na.z;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <div
              key={`e${i}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: len,
                height: 1.5,
                marginLeft: -len / 2,
                marginTop: -0.75,
                background: `linear-gradient(90deg, ${theme.accent}88, ${theme.cyan}88)`,
                transform: `translate3d(${mx}px, ${my}px, ${mz}px) rotateZ(${angle}deg)`,
                opacity: 0.5,
              }}
            />
          );
        })}

        {/* Orbiting particles */}
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2 + frame * 0.04;
          const r = 65;
          const px = Math.cos(angle) * r;
          const pz = Math.sin(angle) * r;
          const py = Math.sin(angle * 0.5 + frame * 0.03) * 15;
          return (
            <div
              key={`p${i}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 5,
                height: 5,
                marginLeft: -2.5,
                marginTop: -2.5,
                borderRadius: "50%",
                background: i % 2 === 0 ? theme.cyan : theme.accentBright,
                boxShadow: `0 0 8px ${i % 2 === 0 ? theme.cyan : theme.accentBright}`,
                transform: `translate3d(${px}px, ${py}px, ${pz}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
