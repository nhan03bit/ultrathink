import { useCurrentFrame, interpolate } from "remotion";
import { theme } from "../theme";

// CSS 3D floating orbs for stats background
export function StatsOrbs3D() {
  const frame = useCurrentFrame();

  const orbs = [
    { x: -500, y: -200, z: -200, color: theme.accent, size: 120 },
    { x: 500, y: 150, z: -300, color: theme.cyan, size: 90 },
    { x: -300, y: 250, z: -100, color: theme.green, size: 70 },
    { x: 400, y: -250, z: -400, color: theme.amber, size: 100 },
    { x: 0, y: -350, z: -500, color: "#a855f7", size: 140 },
    { x: -600, y: 50, z: -250, color: theme.accentBright, size: 60 },
  ];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        perspective: 1000,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transformStyle: "preserve-3d",
          transform: `rotateY(${frame * 0.5}deg)`,
        }}
      >
        {orbs.map((orb, i) => {
          const floatY = Math.sin(frame * 0.03 + i * 1.2) * 30;
          const floatX = Math.cos(frame * 0.02 + i * 0.8) * 20;
          const scale = interpolate(frame, [i * 2, i * 2 + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: orb.size,
                height: orb.size,
                marginLeft: -orb.size / 2,
                marginTop: -orb.size / 2,
                borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, ${orb.color}44, ${orb.color}11, transparent 70%)`,
                boxShadow: `inset 0 0 ${orb.size * 0.3}px ${orb.color}22, 0 0 ${orb.size * 0.5}px ${orb.color}11`,
                transform: `translate3d(${orb.x + floatX}px, ${orb.y + floatY}px, ${orb.z}px) scale(${scale})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
