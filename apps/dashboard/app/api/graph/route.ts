// intent: API route for memory/decision graph — returns nodes + edges for canvas visualization
// status: done
// confidence: high

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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

const IDENTITY_CATEGORIES = [
  "identity",
  "preference",
  "style-preference",
  "tool-preference",
  "project-context",
  "workflow-pattern",
];

const DECISION_CATEGORIES = ["decision"];

function classifyCategory(category: string): "memory" | "decision" | "identity" {
  if (DECISION_CATEGORIES.includes(category)) return "decision";
  if (IDENTITY_CATEGORIES.includes(category)) return "identity";
  return "memory";
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ nodes: [], edges: [], stats: null }, { status: 503 });
  }

  try {
    const sql = getDb();
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "300") || 300, 1000);
    const scope = searchParams.get("scope") ?? undefined;
    const typeFilter = searchParams.get("type") ?? undefined;

    // Fetch memories with tags
    const memoryRows = (await sql`
      SELECT m.id, m.content, m.category, m.importance, m.confidence,
             m.scope, m.created_at, m.updated_at,
             array_agg(mt.tag) FILTER (WHERE mt.tag IS NOT NULL) as tags
      FROM memories m
      LEFT JOIN memory_tags mt ON m.id = mt.memory_id
      WHERE m.is_archived = false
        AND (${scope ?? null}::text IS NULL OR m.scope = ${scope ?? null})
      GROUP BY m.id
      ORDER BY m.importance DESC, m.created_at DESC
      LIMIT ${limit}
    `) as Record<string, unknown>[];

    // Build nodes
    let nodes: GraphNode[] = memoryRows.map((r) => ({
      id: r.id as string,
      type: classifyCategory(r.category as string),
      label: (r.content as string).slice(0, 120),
      importance: Number(r.importance ?? 5),
      confidence: Number(r.confidence ?? 0.8),
      scope: r.scope as string | null,
      category: r.category as string,
      tags: (r.tags as string[]) ?? [],
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
    }));

    // Apply type filter if specified
    if (typeFilter && typeFilter !== "all") {
      nodes = nodes.filter((n) => n.type === typeFilter);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    // Fetch explicit relations from memory_relations
    const edges: GraphEdge[] = [];

    try {
      const relationRows = (await sql`
        SELECT r.source_id, r.target_id, r.relation_type, r.strength
        FROM memory_relations r
        WHERE r.source_id = ANY(${Array.from(nodeIds)}::uuid[])
          OR r.target_id = ANY(${Array.from(nodeIds)}::uuid[])
        ORDER BY r.strength DESC
      `) as Record<string, unknown>[];

      for (const r of relationRows) {
        const src = r.source_id as string;
        const tgt = r.target_id as string;
        if (nodeIds.has(src) && nodeIds.has(tgt)) {
          edges.push({
            source: src,
            target: tgt,
            relationship: (r.relation_type as string) ?? "related",
            strength: Number(r.strength ?? 0.5),
          });
        }
      }
    } catch {
      // memory_relations table might not exist — continue with derived edges
    }

    // Derive edges from shared tags (if explicit relations are sparse)
    if (edges.length < nodes.length / 2) {
      const tagIndex = new Map<string, string[]>();
      for (const n of nodes) {
        for (const tag of n.tags) {
          if (!tagIndex.has(tag)) tagIndex.set(tag, []);
          tagIndex.get(tag)!.push(n.id);
        }
      }

      const edgeSet = new Set(edges.map((e) => `${e.source}:${e.target}`));
      for (const [tag, ids] of Array.from(tagIndex.entries())) {
        if (ids.length < 2 || ids.length > 20) continue; // skip overly common tags
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const key1 = `${ids[i]}:${ids[j]}`;
            const key2 = `${ids[j]}:${ids[i]}`;
            if (!edgeSet.has(key1) && !edgeSet.has(key2)) {
              edges.push({
                source: ids[i],
                target: ids[j],
                relationship: `shared-tag:${tag}`,
                strength: 0.3,
              });
              edgeSet.add(key1);
            }
          }
        }
      }

      // Derive edges from shared scope
      const scopeIndex = new Map<string, string[]>();
      for (const n of nodes) {
        if (n.scope) {
          if (!scopeIndex.has(n.scope)) scopeIndex.set(n.scope, []);
          scopeIndex.get(n.scope)!.push(n.id);
        }
      }

      for (const [, ids] of Array.from(scopeIndex.entries())) {
        if (ids.length < 2 || ids.length > 30) continue;
        for (let i = 0; i < Math.min(ids.length, 10); i++) {
          for (let j = i + 1; j < Math.min(ids.length, 10); j++) {
            const key1 = `${ids[i]}:${ids[j]}`;
            const key2 = `${ids[j]}:${ids[i]}`;
            if (!edgeSet.has(key1) && !edgeSet.has(key2)) {
              edges.push({
                source: ids[i],
                target: ids[j],
                relationship: "shared-scope",
                strength: 0.15,
              });
              edgeSet.add(key1);
            }
          }
        }
      }
    }

    // Stats
    const stats = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      memories: nodes.filter((n) => n.type === "memory").length,
      decisions: nodes.filter((n) => n.type === "decision").length,
      identities: nodes.filter((n) => n.type === "identity").length,
    };

    return NextResponse.json({ nodes, edges, stats });
  } catch (err) {
    console.error("Graph API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
