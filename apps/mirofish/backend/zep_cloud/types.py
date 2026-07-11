"""Local Zep shim — data types"""
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


@dataclass
class EpisodeData:
    data: str
    type: str = "text"


@dataclass
class EntityEdgeSourceTarget:
    source: str
    target: str


# EntityText is used as a type annotation in dynamic Pydantic models
EntityText = str


class InternalServerError(Exception):
    """Mirrors zep_cloud.InternalServerError for retry logic in zep_paging.py"""
    pass


@dataclass
class Episode:
    uuid_: str
    data: str
    type: str = "text"
    processed: bool = True


@dataclass
class Node:
    uuid_: str
    name: str
    labels: List[str] = field(default_factory=lambda: ["Entity"])
    summary: str = ""
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Edge:
    uuid_: str
    source_node_uuid: str
    target_node_uuid: str
    name: str = ""
    fact: str = ""
    labels: List[str] = field(default_factory=list)
    created_at: Optional[str] = None
    valid_at: Optional[str] = None
    invalid_at: Optional[str] = None
    expired_at: Optional[str] = None


@dataclass
class SearchResults:
    edges: List[Edge] = field(default_factory=list)
    nodes: List[Node] = field(default_factory=list)
