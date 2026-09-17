"""FastAPI application factory and lifecycle configuration."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging
import time
import uuid

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from packages.config.settings import Settings, get_settings
from packages.logging import configure_logging, get_logger, log_with_context
from services.api.errors import register_exception_handlers
from services.api.metrics import record_http_request, router as metrics_router
from services.api.routes import api_router

logger = get_logger("services.api.app")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure a production-ready FastAPI application instance.

    Args:
        settings: Optional operational configuration. Defaults to get_settings().

    Returns:
        Configured FastAPI application instance.
    """
    app_settings = settings or get_settings()

    # Configure structured logging with configured log level
    configure_logging(level=app_settings.LOG_LEVEL)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        """Manage application startup and shutdown lifecycle events."""
        log_with_context(
            logger,
            logging.INFO,
            "SIH26162 API application starting up",
            context={
                "environment": app_settings.ENVIRONMENT.value,
                "api_host": app_settings.API_HOST,
                "api_port": app_settings.API_PORT,
                "debug": app_settings.DEBUG,
                "cors_origins_count": len(app_settings.CORS_ORIGINS),
            },
        )
        yield
        log_with_context(
            logger,
            logging.INFO,
            "SIH26162 API application shutting down",
            context={"environment": app_settings.ENVIRONMENT.value},
        )

    is_prod = app_settings.ENVIRONMENT.value == "production"
    docs_enabled = app_settings.DEBUG or not is_prod

    app = FastAPI(
        title="SIH26162 — Satellite Thermal Anomaly & Fire Intelligence System",
        description=(
            "AI-Driven Satellite & Contextual Flare/Fire Intelligence API "
            "providing thermal anomaly segregation, event intelligence, "
            "and GIS endpoints."
        ),
        version="0.1.0",
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        lifespan=lifespan,
    )

    # Attach operational settings to application state
    app.state.settings = app_settings

    # 1. GZip Compression Middleware (compresses payloads >= 1000 bytes)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # 2. CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.CORS_ORIGINS,
        allow_credentials=app_settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=app_settings.CORS_ALLOW_METHODS,
        allow_headers=app_settings.CORS_ALLOW_HEADERS,
    )

    # 3. Security Headers, Request Correlation ID & Telemetry Middleware
    @app.middleware("http")
    async def production_security_and_telemetry_middleware(
        request: Request, call_next
    ) -> Response:
        start_time = time.time()
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())

        response: Response = await call_next(request)

        # Inject Security Headers
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if is_prod:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Record telemetry metrics
        duration = time.time() - start_time
        path = request.url.path
        record_http_request(request.method, path, response.status_code, duration)

        return response

    # 4. Register structured exception handlers
    register_exception_handlers(app)

    # 5. Mount API and Metrics routers
    app.include_router(metrics_router)
    app.include_router(api_router)

    return app


api = create_app()
app = api

