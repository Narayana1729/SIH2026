"""Prometheus metrics collection and export endpoint (OBS-001)."""

from __future__ import annotations

import time
from collections import defaultdict
import threading
from typing import Any

from fastapi import APIRouter, Response

router = APIRouter(tags=["observability"])

_lock = threading.Lock()
_start_time = time.time()
_http_requests = defaultdict(int)
_http_latencies = defaultdict(list)
_ml_predictions = defaultdict(int)


def record_http_request(method: str, path: str, status_code: int, duration_seconds: float) -> None:
    """Record an HTTP request telemetry metric."""
    with _lock:
        key = f'{method}:{path}:{status_code}'
        _http_requests[key] += 1
        lat_list = _http_latencies[f'{method}:{path}']
        lat_list.append(duration_seconds)
        if len(lat_list) > 1000:
            lat_list.pop(0)


def record_ml_prediction(model_name: str, predicted_class: str) -> None:
    """Record a machine learning inference event."""
    with _lock:
        _ml_predictions[f'{model_name}:{predicted_class}'] += 1


@router.get("/metrics", summary="Export Prometheus operational metrics", include_in_schema=False)
def get_metrics() -> Response:
    """Format and return application metrics in standard Prometheus text format."""
    lines: list[str] = [
        "# HELP pyrosat_uptime_seconds System process uptime in seconds",
        "# TYPE pyrosat_uptime_seconds gauge",
        f"pyrosat_uptime_seconds {time.time() - _start_time:.2f}",
        "",
        "# HELP pyrosat_http_requests_total Total count of HTTP requests",
        "# TYPE pyrosat_http_requests_total counter",
    ]

    with _lock:
        for key, count in _http_requests.items():
            parts = key.split(":")
            if len(parts) == 3:
                m, p, s = parts
                lines.append(f'pyrosat_http_requests_total{{method="{m}",path="{p}",status="{s}"}} {count}')

        lines.extend([
            "",
            "# HELP pyrosat_http_latency_seconds_p95 95th percentile request latency in seconds",
            "# TYPE pyrosat_http_latency_seconds_p95 gauge",
        ])
        for path_key, lats in _http_latencies.items():
            if lats:
                parts = path_key.split(":")
                m, p = parts[0], parts[1]
                sorted_lats = sorted(lats)
                p95_idx = int(len(sorted_lats) * 0.95)
                p95_val = sorted_lats[min(p95_idx, len(sorted_lats) - 1)]
                lines.append(f'pyrosat_http_latency_seconds_p95{{method="{m}",path="{p}"}} {p95_val:.5f}')

        lines.extend([
            "",
            "# HELP pyrosat_ml_predictions_total Total ML predictions by model and class",
            "# TYPE pyrosat_ml_predictions_total counter",
        ])
        for ml_key, ml_cnt in _ml_predictions.items():
            parts = ml_key.split(":")
            if len(parts) == 2:
                model, cls_name = parts
                lines.append(f'pyrosat_ml_predictions_total{{model="{model}",class="{cls_name}"}} {ml_cnt}')

    lines.append("")
    output = "\n".join(lines)
    return Response(content=output, media_type="text/plain; version=0.0.4; charset=utf-8")
