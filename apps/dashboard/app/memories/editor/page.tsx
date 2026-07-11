"use client";

// intent: Memory editor — list/search/create/edit/delete memories with inline editing
// status: done
// confidence: high

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
  Brain,
  Zap,
  Fingerprint,
  Tag,
  X,
  ArrowLeft,
  Network,
} from "lucide-react";

interface Memory {
  id: string;
  content: string;
  category: string;
  importance: number;
  confidence: number;
  scope: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  access_count: number;
  is_archived: boolean;
  tags: string[] | null;
}

const CATEGORIES = [
  "architecture",
  "pattern",
  "decision",
  "preference",
  "solution",
  "convention",
  "insight",
  "identity",
  "style-preference",
  "tool-preference",
  "project-context",
  "workflow-pattern",
];

const CATEGORY_COLORS: Record<string, string> = {
  architecture: "#3b82f6",
  pattern: "#22c55e",
  decision: "#f59e0b",
  preference: "#a855f7",
  solution: "#06b6d4",
  convention: "#ec4899",
  insight: "#64748b",
  identity: "#22c55e",
  "style-preference": "#a855f7",
  "tool-preference": "#f97316",
  "project-context": "#3b82f6",
  "workflow-pattern": "#06b6d4",
};

const IDENTITY_CATEGORIES = [
  "identity",
  "preference",
  "style-preference",
  "tool-preference",
  "project-context",
  "workflow-pattern",
];

function getTypeFromCategory(category: string): "memory" | "decision" | "identity" {
  if (category === "decision") return "decision";
  if (IDENTITY_CATEGORIES.includes(category)) return "identity";
  return "memory";
}

export default function MemoryEditorPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, Partial<Memory>>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newMemory, setNewMemory] = useState({
    content: "",
    category: "insight",
    importance: 5,
    confidence: 0.8,
    scope: "",
    tags: "",
  });
  const [creating, setCreating] = useState(false);

  // Fetch memories
  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (searchQuery) params.set("q", searchQuery);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (scopeFilter !== "all") params.set("scope", scopeFilter);

      const res = await fetch(`/api/memory?${params}`);
      const data = await res.json();
      setMemories(data.memories ?? []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, scopeFilter]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Expand a memory for editing
  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      const mem = memories.find((m) => m.id === id);
      if (mem) {
        setEditState((prev) => ({
          ...prev,
          [id]: {
            content: mem.content,
            category: mem.category,
            importance: mem.importance,
            confidence: mem.confidence,
            scope: mem.scope,
          },
        }));
      }
    }
  };

  // Update edit field
  const updateField = (id: string, field: string, value: unknown) => {
    setEditState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // Save memory
  const handleSave = async (id: string) => {
    const edits = editState[id];
    if (!edits) return;

    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...edits }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, ...data.memory } : m)));
      }
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Delete memory
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this memory permanently?")) return;

    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/memory?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        if (expandedId === id) setExpandedId(null);
      }
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Create memory
  const handleCreate = async () => {
    if (!newMemory.content.trim()) return;
    setCreating(true);
    try {
      const tags = newMemory.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMemory.content,
          category: newMemory.category,
          importance: newMemory.importance,
          confidence: newMemory.confidence,
          scope: newMemory.scope || null,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });

      if (res.ok) {
        setNewMemory({
          content: "",
          category: "insight",
          importance: 5,
          confidence: 0.8,
          scope: "",
          tags: "",
        });
        setShowCreate(false);
        fetchMemories();
      }
    } finally {
      setCreating(false);
    }
  };

  // Unique scopes from data
  const scopes = Array.from(new Set(memories.map((m) => m.scope).filter(Boolean) as string[])).sort();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/graph"
            className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Memory Editor</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{memories.length} memories loaded</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/graph"
            className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1.5"
          >
            <Network className="w-4 h-4" />
            Graph View
          </Link>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${
              showCreate
                ? "bg-[var(--color-accent)] text-black"
                : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Plus className="w-4 h-4" />
            New Memory
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wide">Create Memory</h3>
          <textarea
            value={newMemory.content}
            onChange={(e) => setNewMemory((p) => ({ ...p, content: e.target.value }))}
            placeholder="Memory content..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-[var(--color-text-dim)]">Category</label>
              <select
                value={newMemory.category}
                onChange={(e) => setNewMemory((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--color-text-dim)]">Importance ({newMemory.importance})</label>
              <input
                type="range"
                min={1}
                max={10}
                value={newMemory.importance}
                onChange={(e) => setNewMemory((p) => ({ ...p, importance: Number(e.target.value) }))}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--color-text-dim)]">Scope</label>
              <input
                type="text"
                value={newMemory.scope}
                onChange={(e) => setNewMemory((p) => ({ ...p, scope: e.target.value }))}
                placeholder="global"
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--color-text-dim)]">Tags (comma-sep)</label>
              <input
                type="text"
                value={newMemory.tags}
                onChange={(e) => setNewMemory((p) => ({ ...p, tags: e.target.value }))}
                placeholder="tag1, tag2"
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !newMemory.content.trim()}
              className="px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-dim)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          <option value="all">All scopes</option>
          {scopes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Memory list */}
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">Loading memories...</div>
      ) : memories.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-[var(--color-text-muted)]">No memories found.</p>
          <p className="text-sm text-[var(--color-text-dim)]">
            {searchQuery ? "Try a different search query." : "Create your first memory above."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((mem) => {
            const isExpanded = expandedId === mem.id;
            const edit = editState[mem.id];
            const isSaving = savingIds.has(mem.id);
            const isDeleting = deletingIds.has(mem.id);
            const typeKey = getTypeFromCategory(mem.category);
            const color = CATEGORY_COLORS[mem.category] ?? "#64748b";

            return (
              <div
                key={mem.id}
                className={`rounded-xl border transition-all duration-200 ${
                  isExpanded
                    ? "bg-[var(--color-surface)] border-[var(--color-accent)]/30"
                    : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                }`}
              >
                {/* Row header */}
                <button
                  onClick={() => toggleExpand(mem.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-[var(--color-text-dim)] shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-dim)] shrink-0" />
                  )}

                  {/* Type icon */}
                  <span className="shrink-0">
                    {typeKey === "memory" && <Brain className="w-4 h-4" style={{ color }} />}
                    {typeKey === "decision" && <Zap className="w-4 h-4" style={{ color }} />}
                    {typeKey === "identity" && <Fingerprint className="w-4 h-4" style={{ color }} />}
                  </span>

                  {/* Category badge */}
                  <span
                    className="px-2 py-0.5 text-xs rounded-full shrink-0 font-medium"
                    style={{
                      backgroundColor: color + "20",
                      color,
                    }}
                  >
                    {mem.category}
                  </span>

                  {/* Content preview */}
                  <span className="text-sm text-[var(--color-text)] truncate flex-1">
                    {mem.content.slice(0, 80)}
                    {mem.content.length > 80 ? "..." : ""}
                  </span>

                  {/* Importance indicator */}
                  <span className="text-xs text-[var(--color-text-dim)] shrink-0 tabular-nums">
                    imp:{mem.importance}
                  </span>

                  {/* Tags count */}
                  {mem.tags && mem.tags.length > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-[var(--color-text-dim)] shrink-0">
                      <Tag className="w-3 h-3" />
                      {mem.tags.length}
                    </span>
                  )}
                </button>

                {/* Expanded edit form */}
                {isExpanded && edit && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border)]">
                    <div className="pt-3 space-y-2">
                      <label className="text-xs text-[var(--color-text-dim)] uppercase">Content</label>
                      <textarea
                        value={edit.content ?? ""}
                        onChange={(e) => updateField(mem.id, "content", e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--color-text-dim)]">Category</label>
                        <select
                          value={edit.category ?? mem.category}
                          onChange={(e) => updateField(mem.id, "category", e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--color-text-dim)]">
                          Importance ({edit.importance ?? mem.importance})
                        </label>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={edit.importance ?? mem.importance}
                          onChange={(e) => updateField(mem.id, "importance", Number(e.target.value))}
                          className="w-full accent-[var(--color-accent)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--color-text-dim)]">
                          Confidence ({((edit.confidence ?? mem.confidence) * 100).toFixed(0)}%)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((edit.confidence ?? mem.confidence) * 100)}
                          onChange={(e) => updateField(mem.id, "confidence", Number(e.target.value) / 100)}
                          className="w-full accent-[var(--color-accent)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--color-text-dim)]">Scope</label>
                        <input
                          type="text"
                          value={edit.scope ?? mem.scope ?? ""}
                          onChange={(e) => updateField(mem.id, "scope", e.target.value || null)}
                          placeholder="global"
                          className="w-full px-2 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                        />
                      </div>
                    </div>

                    {/* Tags display */}
                    {mem.tags && mem.tags.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--color-text-dim)] flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          Tags
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {mem.tags.map((tag) => (
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

                    {/* Metadata row */}
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-dim)] pt-1">
                      <span>ID: {mem.id.slice(0, 8)}...</span>
                      <span>Created: {new Date(mem.created_at).toLocaleDateString()}</span>
                      <span>Accessed: {mem.access_count}x</span>
                      {mem.source && <span>Source: {mem.source}</span>}
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-between pt-2">
                      <button
                        onClick={() => handleDelete(mem.id)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        onClick={() => handleSave(mem.id)}
                        disabled={isSaving}
                        className="px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
