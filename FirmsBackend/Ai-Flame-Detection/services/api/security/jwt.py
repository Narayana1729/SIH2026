"""Cryptographic JWT token signing, verification, and password hashing (SEC-001).

Zero-dependency standard-library implementation adhering to RFC 7519 (JWT)
and RFC 7515 (JWS HS256).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid
from typing import Any

from packages.errors import UnauthorizedError


def _base64url_encode(data: bytes) -> str:
    """Encode bytes to URL-safe base64 string without trailing padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _base64url_decode(data: str) -> bytes:
    """Decode URL-safe base64 string, adding required padding if necessary."""
    padding = len(data) % 4
    if padding:
        data += "=" * (4 - padding)
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def hash_password(password: str, iterations: int = 100_000) -> str:
    """Hash a plaintext password using PBKDF2-HMAC-SHA256 with a secure salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    )
    return f"pbkdf2_sha256${iterations}${salt}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against PBKDF2-HMAC-SHA256 hash in constant time."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = parts[2]
        expected_hex = parts[3]
        actual_key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations,
        )
        return hmac.compare_digest(actual_key.hex(), expected_hex)
    except Exception:
        return False


def create_access_token(
    subject: str,
    role: str,
    secret_key: str,
    expires_in_seconds: int = 1800,
    custom_claims: dict[str, Any] | None = None,
) -> str:
    """Generate a signed RFC 7519 JWT access token with HS256 signature."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + expires_in_seconds,
        "jti": str(uuid.uuid4()),
    }
    if custom_claims:
        payload.update(custom_claims)

    encoded_header = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")

    signature = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    encoded_signature = _base64url_encode(signature)

    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"


def decode_access_token(token: str, secret_key: str) -> dict[str, Any]:
    """Verify and decode RFC 7519 JWT access token, enforcing expiration and signature validity.

    Raises:
        UnauthorizedError: If token is malformed, signature is invalid, or token is expired.
    """
    parts = token.split(".")
    if len(parts) != 3:
        raise UnauthorizedError("Malformed JWT: token must contain exactly three segments.")

    encoded_header, encoded_payload, encoded_signature = parts
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")

    try:
        expected_signature = hmac.new(
            secret_key.encode("utf-8"), signing_input, hashlib.sha256
        ).digest()
        actual_signature = _base64url_decode(encoded_signature)
    except Exception as err:
        raise UnauthorizedError("Failed to decode token signature.") from err

    if not hmac.compare_digest(expected_signature, actual_signature):
        raise UnauthorizedError("Invalid token signature.")

    try:
        payload_bytes = _base64url_decode(encoded_payload)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception as err:
        raise UnauthorizedError("Failed to parse token payload.") from err

    # Check expiration
    exp = payload.get("exp")
    if exp is None:
        raise UnauthorizedError("Missing 'exp' expiration claim in token.")
    if int(exp) < int(time.time()):
        raise UnauthorizedError("Token has expired.")

    return payload
