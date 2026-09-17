"""Tests for data source integrity and event retrieval."""

from fastapi.testclient import TestClient

from services.api.app import app

client = TestClient(app)


def test_events_endpoint_returns_data_sources():
    response = client.get("/events?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "events" in data
    assert len(data["events"]) > 0

    # Ensure events contain valid metadata and are properly structured
    for event in data["events"]:
        assert "event_id" in event
        assert "started_at" in event
        assert "ended_at" in event
        assert "detection_count" in event
        assert "centroid_latitude" in event
        assert "centroid_longitude" in event


def test_event_detail_endpoint_integrity():
    # First get an event ID
    events_res = client.get("/events?limit=1")
    assert events_res.status_code == 200
    event_id = events_res.json()["events"][0]["event_id"]

    detail_res = client.get(f"/events/{event_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()

    assert detail["event_id"] == event_id
    assert "geometry" in detail
    assert detail["geometry"]["type"] == "Point"
    assert len(detail["geometry"]["coordinates"]) == 2
    assert "context_status" in detail


def test_event_timeline_and_evidence():
    events_res = client.get("/events?limit=1")
    assert events_res.status_code == 200
    event_id = events_res.json()["events"][0]["event_id"]

    timeline_res = client.get(f"/events/{event_id}/timeline")
    assert timeline_res.status_code == 200
    timeline = timeline_res.json()
    assert timeline["event_id"] == event_id
    assert "timeline" in timeline
    assert len(timeline["timeline"]) > 0

    evidence_res = client.get(f"/events/{event_id}/evidence")
    assert evidence_res.status_code == 200
    evidence = evidence_res.json()
    assert evidence["event_id"] == event_id
    assert "context_evidence" in evidence
