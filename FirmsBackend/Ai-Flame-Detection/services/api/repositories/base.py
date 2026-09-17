"""Abstract repository interfaces for PYROSAT data entities."""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from services.api.schemas.events import (
    EventDetailResponse,
    EventEvidenceResponse,
    EventsResponse,
    EventTimelineResponse,
)


class BaseEventRepository(ABC):
    """Abstract Base Class for Event data access."""

    @abstractmethod
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
        """Query and filter events with pagination."""
        pass

    @abstractmethod
    def get_event(self, event_id: str) -> EventDetailResponse:
        """Retrieve single event detail by ID."""
        pass

    @abstractmethod
    def get_event_timeline(self, event_id: str) -> EventTimelineResponse:
        """Retrieve chronological observations for an event."""
        pass

    @abstractmethod
    def get_event_evidence(self, event_id: str) -> EventEvidenceResponse:
        """Retrieve multi-sensor evidence package for an event."""
        pass


class BaseDetectionRepository(ABC):
    """Abstract Base Class for raw satellite detection data access."""

    @abstractmethod
    def query_detections(
        self,
        min_lat: float | None = None,
        max_lat: float | None = None,
        min_lon: float | None = None,
        max_lon: float | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        sensor: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Query detections with spatial and temporal bounds."""
        pass

    @abstractmethod
    def get_detection(self, detection_id: str) -> dict[str, Any] | None:
        """Retrieve single detection by ID."""
        pass
