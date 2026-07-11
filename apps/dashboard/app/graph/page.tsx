"use client";

// intent: Memory/decision graph — canvas force-directed layout matching code graph patterns
// status: done
// confidence: high

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Brain, Zap, Fingerprint, Filter, X, ExternalLink, Tag, Clock, ChevronRight } from "lucide-react";

interface GraphNode {
  id: string;
  type: "memory" | "decision" | "identity";
  label: string;
  importance: number;
  confidence: number;
  scope: string | null;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  strength: number;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  memories: number;
  decisions: number;
  identities: number;
}

const TYPE_COLORS: Record<string, string> = {
  memory: "#3b82f6",
  decision: "#ef4444",
  identity: "#22c55e",
};

const TYPE_LABELS: Record<string, string> = {
  memory: "Memory",
  decision: "Decision",
  identity: "Identity",
};

const ALL_TYPES = ["memory", "decision", "identity"] as const;
const ALL_SCOPES = ["global", "project"] as const;

function lightenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lighten = (v: number) => Math.min(255, v + 80);
  return `rgb(${lighten(r)},${lighten(g)},${lighten(b)})`;
}

export default function MemoryGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(ALL_TYPES));
  const [scopeFilter, setScopeFilter] = useState<Set<string>>(new Set(ALL_SCOPES));
  const [tagFilter, setTagFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editImportance, setEditImportance] = useState(5);
  const [saving, setSaving] = useState(false);

  const offsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOffX: number;
    startOffY: number;
  } | null>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const tickRef = useRef(0);
  const particlesRef = useRef<{ edgeIdx: number; t: number; speed: number }[]>([]);
  const starsRef = useRef<{ x: number; y: number; r: number; a: number }[]>([]);

  // Collect all unique tags from current nodes
  const allTags = Array.from(new Set(nodes.flatMap((n) => n.tags))).sort();

  // Fetch graph data
  useEffect(() => {
    setLoading(true);
    fetch("/api/graph?limit=300")
      .then((r) => r.json())
      .then((data) => {
        const rawNodes: GraphNode[] = data.nodes ?? [];
        const rawEdges: GraphEdge[] = data.edges ?? [];

        // Group by type for initial layout
        const typeGroups: Record<string, GraphNode[]> = {};
        for (const n of rawNodes) {
          if (!typeGroups[n.type]) typeGroups[n.type] = [];
          typeGroups[n.type].push(n);
        }

        const types = Object.keys(typeGroups);
        const initialized: SimNode[] = [];
        let groupIdx = 0;

        for (const type of types) {
          const group = typeGroups[type];
          const angle = (2 * Math.PI * groupIdx) / Math.max(types.length, 1);
          const ringR = 80 + rawNodes.length * 2;

          for (let i = 0; i < group.length; i++) {
            const spread = 40 + group.length * 4;
            initialized.push({
              ...group[i],
              x: Math.cos(angle) * ringR + (Math.random() - 0.5) * spread,
              y: Math.sin(angle) * ringR + (Math.random() - 0.5) * spread,
              vx: 0,
              vy: 0,
            });
          }
          groupIdx++;
        }

        nodesRef.current = initialized;
        edgesRef.current = rawEdges;
        setNodes(initialized);
        setEdges(rawEdges);
        setStats(data.stats ?? null);
        setLoading(false);
        tickRef.current = 0;
        particlesRef.current = [];
        starsRef.current = [];
      })
      .catch(() => setLoading(false));
  }, []);

  // When selectedNode changes, populate edit fields
  useEffect(() => {
    if (selectedNode) {
      setEditContent(selectedNode.label);
      setEditImportance(selectedNode.importance);
    }
  }, [selectedNode]);

  // Force-directed simulation
  const simulate = useCallback(() => {
    const ns = nodesRef.current;
    const es = edgesRef.current;
    if (ns.length === 0) return;

    const nodeMap = new Map<string, number>();
    for (let i = 0; i < ns.length; i++) nodeMap.set(ns[i].id, i);

    const repulsion = 1200;
    const attraction = 0.006;
    const damping = 0.91;
    const centerGravity = 0.0008;

    // Repulsion (Barnes-Hut approximation for large graphs — keep N^2 for <300 nodes)
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x - ns[i].x;
        const dy = ns[j].y - ns[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        ns[i].vx -= fx;
        ns[i].vy -= fy;
        ns[j].vx += fx;
        ns[j].vy += fy;
      }
    }

    // Attraction along edges
    for (const e of es) {
      const si = nodeMap.get(e.source);
      const ti = nodeMap.get(e.target);
      if (si === undefined || ti === undefined) continue;
      const dx = ns[ti].x - ns[si].x;
      const dy = ns[ti].y - ns[si].y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      const force = dist * attraction * (e.strength + 0.1);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      ns[si].vx += fx;
      ns[si].vy += fy;
      ns[ti].vx -= fx;
      ns[ti].vy -= fy;
    }

    // Center gravity + damping
    for (const n of ns) {
      n.vx -= n.x * centerGravity;
      n.vy -= n.y * centerGravity;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
    }

    tickRef.current++;
  }, []);

  // Get node radius based on importance
  const getRadius = useCallback((n: GraphNode): number => {
    return 4 + n.importance * 1.2;
  }, []);

  // Canvas rendering
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const ox = offsetRef.current.x + w / 2;
    const oy = offsetRef.current.y + h / 2;
    const z = zoomRef.current;

    // Background
    ctx.fillStyle = "#07070f";
    ctx.fillRect(0, 0, w, h);

    // Stars
    if (starsRef.current.length === 0) {
      const count = Math.min(200, Math.floor((w * h) / 4000));
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 0.8 + 0.2,
        a: Math.random() * 0.4 + 0.08,
      }));
    }
    for (const s of starsRef.current) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const ns = nodesRef.current;
    const es = edgesRef.current;
    const nodeMap = new Map<string, SimNode>();
    for (const n of ns) nodeMap.set(n.id, n);

    // Visible set based on filters
    const visibleSet = new Set<string>();
    for (const n of ns) {
      if (!typeFilter.has(n.type)) continue;
      if (n.scope && !scopeFilter.has(n.scope)) continue;
      if (tagFilter && !n.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))) continue;
      visibleSet.add(n.id);
    }

    const activeId = selectedNode?.id ?? hoveredNode?.id ?? null;
    const connectedIds = activeId
      ? new Set(
          es
            .filter((e) => e.source === activeId || e.target === activeId)
            .map((e) => (e.source === activeId ? e.target : e.source))
        )
      : new Set<string>();

    // Draw edges
    for (const e of es) {
      if (!visibleSet.has(e.source) || !visibleSet.has(e.target)) continue;
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) continue;

      const isActive = activeId && (e.source === activeId || e.target === activeId);
      const isSharedTag = e.relationship.startsWith("shared-tag:");
      const isSharedScope = e.relationship === "shared-scope";

      ctx.globalAlpha = isActive ? 0.55 : 0.12;
      ctx.strokeStyle = isActive
        ? TYPE_COLORS[nodeMap.get(activeId!)?.type ?? "memory"]
        : isSharedTag
          ? "#475569"
          : isSharedScope
            ? "#334155"
            : "#4b5563";
      ctx.lineWidth = (isActive ? 1.6 : isSharedTag ? 0.6 : 0.8) * z;

      if (isSharedTag) {
        ctx.setLineDash([3 * z, 3 * z]);
      } else if (isSharedScope) {
        ctx.setLineDash([6 * z, 3 * z]);
      } else {
        ctx.setLineDash([]);
      }

      if (isActive) {
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 4 * z;
      }

      ctx.beginPath();
      ctx.moveTo(s.x * z + ox, s.y * z + oy);
      ctx.lineTo(t.x * z + ox, t.y * z + oy);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
    }

    // Particles
    if (particlesRef.current.length === 0 && es.length > 0) {
      const count = Math.min(50, es.length);
      particlesRef.current = Array.from({ length: count }, () => ({
        edgeIdx: Math.floor(Math.random() * es.length),
        t: Math.random(),
        speed: 0.002 + Math.random() * 0.003,
      }));
    }
    for (const p of particlesRef.current) {
      const e = es[p.edgeIdx];
      if (!e || !visibleSet.has(e.source) || !visibleSet.has(e.target)) continue;
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) continue;
      const px = (s.x + (t.x - s.x) * p.t) * z + ox;
      const py = (s.y + (t.y - s.y) * p.t) * z + oy;
      const color = TYPE_COLORS[s.type] ?? "#64748b";
      ctx.globalAlpha = 0.6 * (1 - Math.abs(p.t - 0.5) * 1.4);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(px, py, 1.5 * z, 0, Math.PI * 2);
      ctx.fill();
      p.t = (p.t + p.speed) % 1;
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Draw nodes
    for (const n of ns) {
      if (!visibleSet.has(n.id)) continue;
      const x = n.x * z + ox;
      const y = n.y * z + oy;
      const baseR = getRadius(n);
      const color = TYPE_COLORS[n.type] ?? "#94a3b8";

      const isSelected = selectedNode?.id === n.id;
      const isHovered = hoveredNode?.id === n.id;
      const isConnected = connectedIds.has(n.id);
      const isDimmed = activeId && !isSelected && !isHovered && !isConnected;

      const r = (isSelected ? baseR * 1.5 : isHovered ? baseR * 1.3 : baseR) * z;
      ctx.globalAlpha = isDimmed ? 0.18 : 1;

      // Outer glow
      if (!isDimmed) {
        const glowR = r * (isSelected ? 2.5 : 1.8);
        const grd = ctx.createRadialGradient(x, y, r * 0.4, x, y, glowR);
        grd.addColorStop(0, color + "30");
        grd.addColorStop(1, color + "00");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node fill with gradient
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 18 * z : isHovered ? 12 * z : 5 * z;
      const nodeGrd = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      nodeGrd.addColorStop(0, lightenHex(color));
      nodeGrd.addColorStop(1, color);
      ctx.fillStyle = nodeGrd;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight
      ctx.shadowBlur = 0;
      ctx.globalAlpha = isDimmed ? 0 : 0.3;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Importance ring for high-importance nodes
      if (n.importance >= 8 && !isDimmed) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 * z;
        ctx.beginPath();
        ctx.arc(x, y, r + 3 * z, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Pulse ring for selected
      if (isSelected) {
        const pulse = (Math.sin(tickRef.current * 0.04) + 1) / 2;
        ctx.globalAlpha = 0.25 * (1 - pulse);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, r * (1.8 + pulse * 1.2), 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;

      // Labels
      if (z > 0.5 || isSelected || isHovered || isConnected) {
        ctx.globalAlpha = isDimmed ? 0.1 : isSelected || isHovered ? 1 : 0.55;
        ctx.fillStyle = isSelected || isHovered ? "#f0f0f8" : "#94a3b8";
        ctx.font = `${Math.max(8, 10 * z)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        const label = n.label.length > 40 ? n.label.slice(0, 38) + "..." : n.label;
        ctx.fillText(label, x, y + r + 12 * z);
      }
    }

    ctx.globalAlpha = 1;
  }, [typeFilter, scopeFilter, tagFilter, selectedNode, hoveredNode, getRadius]);

  // Animation loop
  useEffect(() => {
    const loop = () => {
      if (tickRef.current < 500) simulate();
      tickRef.current++;
      render();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [simulate, render]);

  // Mouse interactions
  const getNodeAt = useCallback(
    (clientX: number, clientY: number): SimNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const z = zoomRef.current;
      const ox = offsetRef.current.x + rect.width / 2;
      const oy = offsetRef.current.y + rect.height / 2;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      for (const n of nodesRef.current) {
        const x = n.x * z + ox;
        const y = n.y * z + oy;
        const r = getRadius(n) * z + 4;
        if ((mx - x) ** 2 + (my - y) ** 2 < r ** 2) return n;
      }
      return null;
    },
    [getRadius]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        offsetRef.current.x = dragRef.current.startOffX + (e.clientX - dragRef.current.startX);
        offsetRef.current.y = dragRef.current.startOffY + (e.clientY - dragRef.current.startY);
        return;
      }
      const node = getNodeAt(e.clientX, e.clientY);
      setHoveredNode(node);
      if (canvasRef.current) canvasRef.current.style.cursor = node ? "pointer" : "grab";
    },
    [getNodeAt]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffX: offsetRef.current.x,
      startOffY: offsetRef.current.y,
    };
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        dragRef.current = null;
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          const node = getNodeAt(e.clientX, e.clientY);
          setSelectedNode(node);
        }
      }
    },
    [getNodeAt]
  );

  // Wheel with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomRef.current = Math.max(0.1, Math.min(5, zoomRef.current * factor));
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  const toggleType = (t: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const toggleScope = (s: string) => {
    setScopeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  // Save edited node
  const handleSave = async () => {
    if (!selectedNode) return;
    setSaving(true);
    try {
      await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedNode.id,
          content: editContent,
          importance: editImportance,
        }),
      });
      // Update local state
      const updated = { ...selectedNode, label: editContent.slice(0, 120), importance: editImportance };
      setSelectedNode(updated);
      nodesRef.current = nodesRef.current.map((n) =>
        n.id === updated.id ? { ...n, label: updated.label, importance: updated.importance } : n
      );
      setNodes([...nodesRef.current]);
    } finally {
      setSaving(false);
    }
  };

  // Connected nodes for detail panel
  const connectedNodes = selectedNode
    ? edges
        .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
        .map((e) => ({
          id: e.source === selectedNode.id ? e.target : e.source,
          relationship: e.relationship,
          direction: e.source === selectedNode.id ? ("outgoing" as const) : ("incoming" as const),
        }))
    : [];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      <div className="flex-1 relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
        {/* Top bar */}
        <div className="absolute top-4 left-4 z-10 flex gap-2 items-center flex-wrap">
          <div className="px-3 py-2 rounded-lg bg-[var(--color-surface)]/90 backdrop-blur border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)]">
            Memory Graph
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5
              ${showFilters ? "bg-[var(--color-accent)] text-black" : "bg-[var(--color-surface)]/80 backdrop-blur border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="absolute top-16 left-4 z-10 p-4 rounded-lg bg-[var(--color-surface)]/95 backdrop-blur border border-[var(--color-border)] space-y-3 max-w-xs">
            <div>
              <p className="text-xs text-[var(--color-text-dim)] uppercase mb-2">Node Type</p>
              <div className="flex flex-wrap gap-1">
                {ALL_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`px-2 py-1 rounded text-xs transition-all duration-150 flex items-center gap-1 ${
                      typeFilter.has(t)
                        ? "text-black font-medium"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-dim)]"
                    }`}
                    style={typeFilter.has(t) ? { backgroundColor: TYPE_COLORS[t] } : undefined}
                  >
                    {t === "memory" && <Brain className="w-3 h-3" />}
                    {t === "decision" && <Zap className="w-3 h-3" />}
                    {t === "identity" && <Fingerprint className="w-3 h-3" />}
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-dim)] uppercase mb-2">Scope</p>
              <div className="flex flex-wrap gap-1">
                {ALL_SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleScope(s)}
                    className={`px-2 py-1 rounded text-xs transition-all duration-150 ${
                      scopeFilter.has(s)
                        ? "bg-[var(--color-accent)] text-black font-medium"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-dim)]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {allTags.length > 0 && (
              <div>
                <p className="text-xs text-[var(--color-text-dim)] uppercase mb-2">Tag Filter</p>
                <input
                  type="text"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="Filter by tag..."
                  className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
                {tagFilter && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {allTags
                      .filter((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))
                      .slice(0, 10)
                      .map((t) => (
                        <button
                          key={t}
                          onClick={() => setTagFilter(t)}
                          className="px-1.5 py-0.5 rounded text-xs bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-accent)] hover:text-black transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats overlay */}
        {stats && stats.totalNodes > 0 && (
          <div className="absolute top-4 right-4 z-10 flex gap-3">
            {[
              {
                label: "Memories",
                value: stats.memories,
                color: TYPE_COLORS.memory,
              },
              {
                label: "Decisions",
                value: stats.decisions,
                color: TYPE_COLORS.decision,
              },
              {
                label: "Identity",
                value: stats.identities,
                color: TYPE_COLORS.identity,
              },
              {
                label: "Edges",
                value: stats.totalEdges,
                color: "var(--color-info)",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="px-3 py-2 rounded-lg bg-[var(--color-surface)]/80 backdrop-blur border border-[var(--color-border)] text-center"
              >
                <p className="text-xs text-[var(--color-text-dim)]">{s.label}</p>
                <p className="text-sm font-bold" style={{ color: s.color }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 right-4 z-10 flex gap-3 px-4 py-2 rounded-lg bg-[var(--color-surface)]/80 backdrop-blur border border-[var(--color-border)]">
          {Object.entries(TYPE_COLORS)
            .filter(([k]) => typeFilter.has(k))
            .map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-[var(--color-text-muted)]">{TYPE_LABELS[type]}</span>
              </div>
            ))}
        </div>

        {/* Back + editor link */}
        <div className="absolute bottom-4 left-4 z-10 flex gap-2">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-[var(--color-surface)]/80 backdrop-blur border border-[var(--color-border)]
                       text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors duration-150"
          >
            &larr; Dashboard
          </Link>
          <Link
            href="/memories/editor"
            className="px-4 py-2 rounded-lg bg-[var(--color-surface)]/80 backdrop-blur border border-[var(--color-border)]
                       text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors duration-150 flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Editor
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[var(--color-text-muted)]">Loading memory graph...</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full flex-col gap-2">
            <p className="text-[var(--color-text-muted)]">No memories found.</p>
            <p className="text-sm text-[var(--color-text-dim)]">Memories will appear here as they are created.</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          />
        )}
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <div className="w-80 shrink-0 p-6 border border-l-0 border-[var(--color-border)] rounded-r-xl bg-[var(--color-surface)] overflow-y-auto space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {selectedNode.type === "memory" && <Brain className="w-5 h-5" style={{ color: TYPE_COLORS.memory }} />}
              {selectedNode.type === "decision" && <Zap className="w-5 h-5" style={{ color: TYPE_COLORS.decision }} />}
              {selectedNode.type === "identity" && (
                <Fingerprint className="w-5 h-5" style={{ color: TYPE_COLORS.identity }} />
              )}
              <span
                className="px-2 py-0.5 text-xs rounded-full border font-medium"
                style={{
                  backgroundColor: `${TYPE_COLORS[selectedNode.type]}20`,
                  color: TYPE_COLORS[selectedNode.type],
                  borderColor: `${TYPE_COLORS[selectedNode.type]}30`,
                }}
              >
                {TYPE_LABELS[selectedNode.type]}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors duration-150 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Editable content */}
          <div className="space-y-2">
            <label className="text-xs text-[var(--color-text-dim)] uppercase">Content</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Importance slider */}
          <div className="space-y-2">
            <label className="text-xs text-[var(--color-text-dim)] uppercase flex justify-between">
              <span>Importance</span>
              <span className="text-[var(--color-text)]">{editImportance}</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={editImportance}
              onChange={(e) => setEditImportance(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-accent)] text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          {/* Metadata */}
          <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-dim)]">Category:</span>
              <span>{selectedNode.category}</span>
            </div>
            {selectedNode.scope && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <span className="text-[var(--color-text-dim)]">Scope:</span>
                <span>{selectedNode.scope}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-dim)]">Confidence:</span>
              <span>{(selectedNode.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-dim)]">
              <Clock className="w-3 h-3" />
              {new Date(selectedNode.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Tags */}
          {selectedNode.tags.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-dim)] uppercase">
                <Tag className="w-3 h-3" />
                Tags
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedNode.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Connected nodes */}
          {connectedNodes.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
              <h4 className="text-xs font-semibold text-[var(--color-text-dim)] uppercase">
                Connections ({connectedNodes.length})
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {connectedNodes.map((conn) => {
                  const node = nodesRef.current.find((n) => n.id === conn.id);
                  return (
                    <button
                      key={`${conn.id}-${conn.relationship}`}
                      onClick={() => {
                        if (node) setSelectedNode(node);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-[var(--color-surface-2)] transition-colors duration-150"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: TYPE_COLORS[node?.type ?? "memory"],
                        }}
                      />
                      <span className="text-[var(--color-text)] truncate">
                        {node?.label.slice(0, 50) ?? conn.id.slice(0, 8)}
                      </span>
                      <ChevronRight className="w-3 h-3 text-[var(--color-text-dim)] ml-auto shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
