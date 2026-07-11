export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "method"
  | "property"
  | "module"
  | "namespace";

export type EdgeType = "imports" | "calls" | "extends" | "implements" | "type_ref" | "re_exports";

export interface CodeGraphNode {
  id: string;
  name: string;
  kind: SymbolKind;
  filePath: string;
  lineNumber: number;
  isExported: boolean;
  signature: string | null;
}

export interface CodeGraphEdge {
  source: string;
  target: string;
  type: EdgeType;
}

export interface CodeGraphStats {
  totalNodes: number;
  totalEdges: number;
  avgConnections: number;
  density: number;
  kindCounts: Record<string, number>;
  edgeTypeCounts: Record<string, number>;
}

export interface CodeGraphResponse {
  projects: { id: string; name: string }[];
  nodes: CodeGraphNode[];
  edges: CodeGraphEdge[];
  stats: CodeGraphStats;
}

export interface ImpactEntry {
  hop: number;
  symbolId: string;
  symbolName: string;
  kind: SymbolKind;
  filePath: string;
  edgeType: EdgeType;
}
