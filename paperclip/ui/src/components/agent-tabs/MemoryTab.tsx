// intent: per-agent UltraThink memory panel — grouped by wing/hall, search, importance
// status: done
// confidence: high

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, Search } from "lucide-react";
import { utBridge, type UTMemory } from "../../api/utBridge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "../../lib/utils";

const WING_LABEL: Record<string, string> = {
  agent: "Agent (who I am)",
  user: "User (who you are)",
  knowledge: "Knowledge (what I learned)",
  experience: "Experience (what happened)",
};

const LAYER_LABEL: Record<number, string> = {
  0: "L0 core",
  1: "L1 essential",
  2: "L2 context",
  3: "L3 on-demand",
};

function importanceColor(i: number | null): string {
  if (i === null) return "bg-muted text-muted-foreground";
  if (i >= 8) return "bg-red-500/15 text-red-600 dark:text-red-400";
  if (i >= 6) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (i >= 4) return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
  return "bg-muted text-muted-foreground";
}

function MemoryRow({ m }: { m: UTMemory }) {
  const wingHall = `${m.wing ?? "?"}/${m.hall ?? "?"}`;
  return (
    <li className="rounded-md border border-border bg-card/40 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-tight truncate">{m.title || wingHall}</div>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            importanceColor(m.importance)
          )}
          title={`importance ${m.importance ?? "n/a"} · confidence ${m.confidence ?? "n/a"}`}
        >
          {m.importance ?? "—"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{m.content}</p>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
        <span>{wingHall}</span>
        {m.layer !== null && <span>{LAYER_LABEL[m.layer] ?? `L${m.layer}`}</span>}
        {m.category && <span>· {m.category}</span>}
        <span className="ml-auto">{new Date(m.updated_at).toLocaleDateString()}</span>
      </div>
    </li>
  );
}

export function AgentMemoryTab({ agentId }: { agentId: string }) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 250);

  const { data, isLoading } = useQuery<UTMemory[] | null>({
    queryKey: ["ut-bridge", "memories", agentId, debouncedQ],
    queryFn: () => utBridge.memories(agentId, debouncedQ || undefined),
    staleTime: 30_000,
  });

  const memories = data ?? [];
  const grouped = useMemo(() => {
    const out: Record<string, UTMemory[]> = {};
    for (const m of memories) {
      const key = m.wing ?? "uncategorized";
      (out[key] ??= []).push(m);
    }
    return out;
  }, [memories]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">UltraThink memories</h2>
        <span className="text-xs text-muted-foreground">
          {memories.length} {memories.length === 1 ? "entry" : "entries"} · approximated by name match
        </span>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search memories…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
          No memories matched this agent.
        </p>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([wing, items]) => (
            <section key={wing}>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                {WING_LABEL[wing] ?? wing} · {items.length}
              </h3>
              <ul className="space-y-2">
                {items.map((m) => (
                  <MemoryRow key={m.id} m={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
