"""Local Zep shim — SQLite-backed client with Ollama entity extraction.

Drop-in replacement for zep_cloud.client.Zep.
Activated when this package (backend/zep_cloud/) shadows the installed
zep-cloud package via sys.path priority (run.py inserts backend/ first).

Set ZEP_API_KEY=local in .env to use this shim.
Graph data is stored in backend/.local_zep.db.
"""

import json
import os
import re
import sqlite3
import threading
import uuid as _uuid_lib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .types import (
    Edge, EpisodeData, Episode, EntityEdgeSourceTarget,
    Node, SearchResults,
)

# ── Storage ──────────────────────────────────────────────────────────────────

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DB_PATH = os.path.join(_BACKEND_DIR, ".local_zep.db")
_db_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(_DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def _init_db() -> None:
    with _db_lock:
        c = _conn()
        c.executescript("""
            CREATE TABLE IF NOT EXISTS graphs (
                id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                ontology TEXT,
                created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS episodes (
                uuid TEXT PRIMARY KEY,
                graph_id TEXT,
                type TEXT,
                data TEXT,
                processed INTEGER DEFAULT 0,
                created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS nodes (
                uuid TEXT PRIMARY KEY,
                graph_id TEXT,
                name TEXT,
                labels TEXT DEFAULT '["Entity"]',
                summary TEXT DEFAULT '',
                attributes TEXT DEFAULT '{}',
                created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS edges (
                uuid TEXT PRIMARY KEY,
                graph_id TEXT,
                name TEXT DEFAULT '',
                source_node_uuid TEXT,
                target_node_uuid TEXT,
                fact TEXT DEFAULT '',
                labels TEXT DEFAULT '[]',
                created_at TEXT,
                valid_at TEXT,
                invalid_at TEXT,
                expired_at TEXT
            );
        """)
        c.commit()
        c.close()


_init_db()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen() -> str:
    return str(_uuid_lib.uuid4())


# ── Entity extraction (background) ───────────────────────────────────────────

def _extract(graph_id: str, ep_uuid: str, text: str, ontology: Optional[Dict]) -> None:
    """Call local Ollama to extract entities/relationships from episode text."""
    try:
        from openai import OpenAI  # already installed in the venv

        api_key = os.environ.get("LLM_API_KEY", "ollama")
        base_url = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")
        model = os.environ.get("LLM_MODEL_NAME", "qwen3.6:27b")

        entity_hint = ""
        edge_hint = ""
        if ontology:
            etypes = [e.get("name", "") for e in ontology.get("entity_types", [])]
            rtypes = [e.get("name", "") for e in ontology.get("edge_types", [])]
            if etypes:
                entity_hint = f"\nPrefer entity types: {', '.join(etypes)}"
            if rtypes:
                edge_hint = f"\nPrefer relation types: {', '.join(rtypes)}"

        prompt = (
            "Extract named entities and relationships. Return ONLY valid JSON. /no_think"
            f"{entity_hint}{edge_hint}\n\n"
            'JSON format: {"entities":[{"name":"str","type":"str","summary":"str"}],'
            '"relationships":[{"source":"name","target":"name","type":"str","fact":"str"}]}\n\n'
            f"Text:\n{text[:2000]}"
        )

        llm = OpenAI(api_key=api_key, base_url=base_url)
        resp = llm.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=1024,
        )
        raw = resp.choices[0].message.content or "{}"
        raw = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
        data = json.loads(raw)

        with _db_lock:
            c = _conn()
            node_map: Dict[str, str] = {}

            for ent in data.get("entities", []):
                name = (ent.get("name") or "").strip()
                if not name:
                    continue
                etype = ent.get("type") or "Entity"
                summary = ent.get("summary") or ""
                existing = c.execute(
                    "SELECT uuid FROM nodes WHERE graph_id=? AND name=?",
                    (graph_id, name),
                ).fetchone()
                if existing:
                    node_map[name] = existing["uuid"]
                else:
                    nid = _gen()
                    node_map[name] = nid
                    c.execute(
                        "INSERT INTO nodes (uuid,graph_id,name,labels,summary,attributes,created_at)"
                        " VALUES (?,?,?,?,?,?,?)",
                        (nid, graph_id, name, json.dumps(["Entity", etype]), summary, "{}", _now()),
                    )

            for rel in data.get("relationships", []):
                src = (rel.get("source") or "").strip()
                tgt = (rel.get("target") or "").strip()
                rtype = rel.get("type") or "RELATED_TO"
                fact = rel.get("fact") or ""
                sid = node_map.get(src)
                tid = node_map.get(tgt)
                if sid and tid:
                    now = _now()
                    c.execute(
                        "INSERT INTO edges"
                        " (uuid,graph_id,name,source_node_uuid,target_node_uuid,fact,labels,created_at,valid_at)"
                        " VALUES (?,?,?,?,?,?,?,?,?)",
                        (_gen(), graph_id, rtype, sid, tid, fact, json.dumps([rtype]), now, now),
                    )

            c.execute("UPDATE episodes SET processed=1 WHERE uuid=?", (ep_uuid,))
            c.commit()
            c.close()

    except Exception:
        # Always mark processed to avoid infinite polling loop
        try:
            with _db_lock:
                c = _conn()
                c.execute("UPDATE episodes SET processed=1 WHERE uuid=?", (ep_uuid,))
                c.commit()
                c.close()
        except Exception:
            pass


# ── Sub-clients ───────────────────────────────────────────────────────────────

def _row_to_node(r: sqlite3.Row) -> Node:
    return Node(
        uuid_=r["uuid"],
        name=r["name"],
        labels=json.loads(r["labels"] or '["Entity"]'),
        summary=r["summary"] or "",
        attributes=json.loads(r["attributes"] or "{}"),
    )


def _row_to_edge(r: sqlite3.Row) -> Edge:
    return Edge(
        uuid_=r["uuid"],
        name=r["name"] or "",
        source_node_uuid=r["source_node_uuid"],
        target_node_uuid=r["target_node_uuid"],
        fact=r["fact"] or "",
        labels=json.loads(r["labels"] or "[]"),
        created_at=r["created_at"],
        valid_at=r["valid_at"],
        invalid_at=r["invalid_at"],
        expired_at=r["expired_at"],
    )


class _EpisodeClient:
    def get(self, uuid_: str) -> Episode:
        with _db_lock:
            c = _conn()
            row = c.execute("SELECT * FROM episodes WHERE uuid=?", (uuid_,)).fetchone()
            c.close()
        if row:
            return Episode(uuid_=row["uuid"], data=row["data"], type=row["type"],
                           processed=bool(row["processed"]))
        return Episode(uuid_=uuid_, data="", type="text", processed=True)


class _NodeClient:
    def get(self, uuid_: str) -> Optional[Node]:
        with _db_lock:
            c = _conn()
            row = c.execute("SELECT * FROM nodes WHERE uuid=?", (uuid_,)).fetchone()
            c.close()
        return _row_to_node(row) if row else None

    def get_by_graph_id(self, graph_id: str, limit: int = 100,
                        uuid_cursor: Optional[str] = None) -> List[Node]:
        with _db_lock:
            c = _conn()
            if uuid_cursor:
                rows = c.execute(
                    "SELECT * FROM nodes WHERE graph_id=? AND uuid>? ORDER BY uuid LIMIT ?",
                    (graph_id, uuid_cursor, limit),
                ).fetchall()
            else:
                rows = c.execute(
                    "SELECT * FROM nodes WHERE graph_id=? ORDER BY uuid LIMIT ?",
                    (graph_id, limit),
                ).fetchall()
            c.close()
        return [_row_to_node(r) for r in rows]

    def get_entity_edges(self, node_uuid: str) -> List[Edge]:
        with _db_lock:
            c = _conn()
            rows = c.execute(
                "SELECT * FROM edges WHERE source_node_uuid=? OR target_node_uuid=?",
                (node_uuid, node_uuid),
            ).fetchall()
            c.close()
        return [_row_to_edge(r) for r in rows]


class _EdgeClient:
    def get_by_graph_id(self, graph_id: str, limit: int = 100,
                        uuid_cursor: Optional[str] = None) -> List[Edge]:
        with _db_lock:
            c = _conn()
            if uuid_cursor:
                rows = c.execute(
                    "SELECT * FROM edges WHERE graph_id=? AND uuid>? ORDER BY uuid LIMIT ?",
                    (graph_id, uuid_cursor, limit),
                ).fetchall()
            else:
                rows = c.execute(
                    "SELECT * FROM edges WHERE graph_id=? ORDER BY uuid LIMIT ?",
                    (graph_id, limit),
                ).fetchall()
            c.close()
        return [_row_to_edge(r) for r in rows]


class _GraphClient:
    def __init__(self) -> None:
        self.episode = _EpisodeClient()
        self.node = _NodeClient()
        self.edge = _EdgeClient()

    def create(self, graph_id: str, name: str = "", description: str = "") -> None:
        with _db_lock:
            c = _conn()
            c.execute(
                "INSERT OR REPLACE INTO graphs (id,name,description,ontology,created_at) VALUES (?,?,?,?,?)",
                (graph_id, name, description, None, _now()),
            )
            c.commit()
            c.close()

    def delete(self, graph_id: str) -> None:
        with _db_lock:
            c = _conn()
            for tbl in ("graphs", "episodes", "nodes", "edges"):
                col = "id" if tbl == "graphs" else "graph_id"
                c.execute(f"DELETE FROM {tbl} WHERE {col}=?", (graph_id,))
            c.commit()
            c.close()

    def set_ontology(self, graph_ids: List[str],
                     entities: Optional[Any] = None,
                     edges: Optional[Any] = None) -> None:
        ontology = {
            "entity_types": [{"name": k} for k in (entities or {}).keys()],
            "edge_types":   [{"name": k} for k in (edges   or {}).keys()],
        }
        with _db_lock:
            c = _conn()
            for gid in graph_ids:
                c.execute("UPDATE graphs SET ontology=? WHERE id=?",
                          (json.dumps(ontology), gid))
            c.commit()
            c.close()

    def add(self, graph_id: str, type: str = "text", data: str = "") -> Episode:
        ep_uuid = _gen()
        with _db_lock:
            c = _conn()
            c.execute(
                "INSERT INTO episodes (uuid,graph_id,type,data,processed,created_at) VALUES (?,?,?,?,0,?)",
                (ep_uuid, graph_id, type, data, _now()),
            )
            row = c.execute("SELECT ontology FROM graphs WHERE id=?", (graph_id,)).fetchone()
            ontology = json.loads(row["ontology"]) if row and row["ontology"] else None
            c.commit()
            c.close()
        threading.Thread(target=_extract, args=(graph_id, ep_uuid, data, ontology),
                         daemon=True).start()
        return Episode(uuid_=ep_uuid, data=data, type=type, processed=False)

    def add_batch(self, graph_id: str, episodes: List[EpisodeData]) -> List[Episode]:
        results: List[Episode] = []
        with _db_lock:
            c = _conn()
            row = c.execute("SELECT ontology FROM graphs WHERE id=?", (graph_id,)).fetchone()
            ontology = json.loads(row["ontology"]) if row and row["ontology"] else None
            for ep in episodes:
                ep_uuid = _gen()
                data = ep.data if hasattr(ep, "data") else str(ep)
                ep_type = ep.type if hasattr(ep, "type") else "text"
                c.execute(
                    "INSERT INTO episodes (uuid,graph_id,type,data,processed,created_at) VALUES (?,?,?,?,0,?)",
                    (ep_uuid, graph_id, ep_type, data, _now()),
                )
                results.append(Episode(uuid_=ep_uuid, data=data, type=ep_type, processed=False))
            c.commit()
            c.close()
        for ep_obj in results:
            idx = results.index(ep_obj)
            threading.Thread(
                target=_extract,
                args=(graph_id, ep_obj.uuid_, episodes[idx].data if hasattr(episodes[idx], "data") else "", ontology),
                daemon=True,
            ).start()
        return results

    def search(self, graph_id: str, query: str, limit: int = 10,
               scope: str = "edges", reranker: str = "") -> SearchResults:
        terms = [t for t in query.lower().split() if len(t) > 1]

        def score(text: str) -> int:
            lo = (text or "").lower()
            return sum(1 for t in terms if t in lo)

        with _db_lock:
            c = _conn()
            edge_rows = c.execute(
                "SELECT * FROM edges WHERE graph_id=? ORDER BY created_at DESC LIMIT ?",
                (graph_id, limit * 5),
            ).fetchall()
            node_rows = c.execute(
                "SELECT * FROM nodes WHERE graph_id=? ORDER BY created_at DESC LIMIT ?",
                (graph_id, limit * 3),
            ).fetchall()
            c.close()

        if terms:
            scored_edges = sorted(
                [r for r in edge_rows if score(r["fact"]) + score(r["name"]) > 0],
                key=lambda r: score(r["fact"]) + score(r["name"]),
                reverse=True,
            )[:limit]
            scored_nodes = sorted(
                [r for r in node_rows if score(r["summary"]) + score(r["name"]) > 0],
                key=lambda r: score(r["summary"]) + score(r["name"]),
                reverse=True,
            )[:limit]
        else:
            scored_edges = list(edge_rows[:limit])
            scored_nodes = list(node_rows[:limit])

        return SearchResults(
            edges=[_row_to_edge(r) for r in scored_edges],
            nodes=[_row_to_node(r) for r in scored_nodes],
        )


# ── Public API ────────────────────────────────────────────────────────────────

class Zep:
    """Local Zep shim — SQLite + Ollama. Accepts any api_key value."""

    def __init__(self, api_key: str = "local", **kwargs: Any) -> None:
        self.graph = _GraphClient()
