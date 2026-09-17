"""Tests for Prometheus /metrics observability endpoint and security headers."""

from fastapi.testclient import TestClient

from services.api.app import app

client = TestClient(app)


def test_metrics_endpoint_returns_prometheus_format():
    # Make a few sample requests
    client.get("/health")
    client.get("/version")

    response = client.get("/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")

    content = response.text
    assert "pyrosat_http_requests_total" in content
    assert "pyrosat_http_latency_seconds_p95" in content
    assert "pyrosat_uptime_seconds" in content
    assert "pyrosat_ml_predictions_total" in content


def test_security_headers_present():
    response = client.get("/health")
    assert response.status_code == 200

    # Verify enterprise security headers
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "X-Correlation-ID" in response.headers
