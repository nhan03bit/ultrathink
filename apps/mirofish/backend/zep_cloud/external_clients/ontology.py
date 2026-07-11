"""Local Zep shim — ontology base types.

graph_builder.py does:
    entity_class = type(name, (EntityModel,), attrs)
    edge_class   = type(name, (EdgeModel,),   attrs)

These just need to be valid Pydantic BaseModel subclasses; the shim
doesn't use the class objects for actual validation.
"""
try:
    from pydantic import BaseModel
except ImportError:
    class BaseModel:  # type: ignore[no-redef]
        pass


class EntityModel(BaseModel):
    """Base class for dynamically created entity types."""
    model_config = {"arbitrary_types_allowed": True}


class EdgeModel(BaseModel):
    """Base class for dynamically created edge types."""
    model_config = {"arbitrary_types_allowed": True}
