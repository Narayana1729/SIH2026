"""Tests for JWT token management, password hashing, and RBAC authentication."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from packages.config.settings import get_settings
from packages.errors import UnauthorizedError
from services.api.app import app
from services.api.security.auth import UserRole
from services.api.security.jwt import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

client = TestClient(app)


def test_password_hashing_and_verification():
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    assert hashed.startswith("pbkdf2_sha256$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_encoding_and_decoding():
    secret = "test-secret-key-1234567890"

    token = create_access_token(
        subject="analyst@pyrosat.io",
        role="ANALYST",
        secret_key=secret,
        expires_in_seconds=900,
    )
    decoded = decode_access_token(token, secret_key=secret)

    assert decoded["sub"] == "analyst@pyrosat.io"
    assert decoded["role"] == "ANALYST"
    assert "exp" in decoded


def test_jwt_token_expiration():
    secret = "test-secret-key-1234567890"

    # Token expired 10 seconds ago
    token = create_access_token(
        subject="analyst@pyrosat.io",
        role="ANALYST",
        secret_key=secret,
        expires_in_seconds=-10,
    )

    with pytest.raises(UnauthorizedError, match="Token has expired"):
        decode_access_token(token, secret_key=secret)


def test_jwt_token_tampering():
    secret = "test-secret-key-1234567890"

    token = create_access_token(
        subject="analyst@pyrosat.io",
        role="ANALYST",
        secret_key=secret,
        expires_in_seconds=900,
    )
    parts = token.split(".")
    # Tamper with the payload
    tampered_token = f"{parts[0]}.eyJyZXF1ZXN0IjogImhhY2tlZCJ9.{parts[2]}"

    with pytest.raises(UnauthorizedError, match="Invalid token signature"):
        decode_access_token(tampered_token, secret_key=secret)


def test_auth_token_endpoint():
    analyst_key = get_settings().ANALYST_API_KEY.get_secret_value()
    response = client.post(
        "/api/v1/auth/token",
        json={"user_id": "analyst@pyrosat.io", "role": "ANALYST", "api_key": analyst_key},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "ANALYST"
    assert data["user_id"] == "analyst@pyrosat.io"


def test_auth_me_endpoint_with_valid_jwt():
    secret = get_settings().SECRET_KEY.get_secret_value()
    token = create_access_token(
        subject="test-analyst-1",
        role="ANALYST",
        secret_key=secret,
    )
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test-analyst-1"
    assert data["role"] == "ANALYST"


def test_auth_me_endpoint_with_invalid_token():
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.token.signature"},
    )
    assert response.status_code == 401
    assert "Invalid or expired" in response.json()["detail"]


def test_auth_me_endpoint_missing_header():
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]

