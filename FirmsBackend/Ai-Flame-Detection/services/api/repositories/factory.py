"""Repository factory and dependency providers."""

from functools import lru_cache

from packages.config.settings import get_settings
from services.api.repositories.base import BaseEventRepository
from services.api.repositories.cached_repository import CachedEventRepository


@lru_cache(maxsize=1)
def get_event_repository() -> BaseEventRepository:
    """Return the configured event repository instance."""
    settings = get_settings()
    # In future migrations with live PostGIS connections, instantiate PostgresEventRepository here.
    # Default to high-performance indexed CachedEventRepository.
    return CachedEventRepository()
