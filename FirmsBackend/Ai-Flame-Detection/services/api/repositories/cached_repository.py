"""Cached in-memory implementation of BaseEventRepository."""

from datetime import datetime

from services.api.repositories.base import BaseEventRepository
from services.api.schemas.events import (
    EventDetailResponse,
    EventEvidenceResponse,
    EventsResponse,
    EventTimelineResponse,
)
from services.api.services.events import EventQueryService


class CachedEventRepository(BaseEventRepository):
    """In-memory indexed event repository backing standard high-performance query operations."""

    def query_events(
        self,
        min_lat: float | None = None,
        max_lat: float | None = None,
        min_lon: float | None = None,
        max_lon: float | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        status: str | None = None,
        classification_state: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> EventsResponse:
        return EventQueryService.query_events(
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
            start_time=start_time,
            end_time=end_time,
            status=status,
            classification_state=classification_state,
            limit=limit,
            offset=offset,
        )

    def get_event(self, event_id: str) -> EventDetailResponse:
        return EventQueryService.get_event(event_id)

    def get_event_timeline(self, event_id: str) -> EventTimelineResponse:
        return EventQueryService.get_event_timeline(event_id)

    def get_event_evidence(self, event_id: str) -> EventEvidenceResponse:
        return EventQueryService.get_event_evidence(event_id)
