"""Local Zep shim package.

This directory (backend/zep_cloud/) shadows the installed zep-cloud package
because run.py does sys.path.insert(0, backend/) — Python finds this first.

Exports match what MiroFish imports from zep_cloud:
    from zep_cloud.client import Zep
    from zep_cloud import EpisodeData, EntityEdgeSourceTarget, EntityText
    from zep_cloud import InternalServerError
    from zep_cloud.external_clients.ontology import EntityModel, EdgeModel
"""

from .client import Zep
from .types import (
    EpisodeData,
    EntityEdgeSourceTarget,
    EntityText,
    InternalServerError,
    Episode,
    Node,
    Edge,
    SearchResults,
)

__all__ = [
    "Zep",
    "EpisodeData",
    "EntityEdgeSourceTarget",
    "EntityText",
    "InternalServerError",
    "Episode",
    "Node",
    "Edge",
    "SearchResults",
]
