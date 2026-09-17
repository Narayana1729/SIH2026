"""Authentication, Role-Based Access Control (RBAC), and JWT token verification (SEC-002)."""

from collections.abc import Callable, Sequence
from enum import StrEnum
import logging
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict

from packages.config.settings import Settings, get_settings
from packages.errors import UnauthorizedError
from packages.logging import get_logger, log_with_context
from services.api.security.jwt import decode_access_token

logger = get_logger("services.api.security.auth")
security_bearer = HTTPBearer(auto_error=False)


class UserRole(StrEnum):
    """Hierarchical user access roles for emergency intelligence operations."""

    VIEWER = "VIEWER"
    ANALYST = "ANALYST"
    DISPATCHER = "DISPATCHER"
    ADMIN = "ADMIN"
    SYSTEM_INGESTION = "SYSTEM_INGESTION"


ROLE_HIERARCHY: dict[UserRole, int] = {
    UserRole.VIEWER: 1,
    UserRole.ANALYST: 2,
    UserRole.DISPATCHER: 3,
    UserRole.ADMIN: 4,
    UserRole.SYSTEM_INGESTION: 5,
}


class AuthenticatedUser(BaseModel):
    """Identity contract for authenticated operators and ingestion agents."""

    model_config = ConfigDict(frozen=True)

    user_id: str
    role: UserRole
    token_type: str = "bearer"
    client_ip: str | None = None


def authenticate_token(token: str, settings: Settings) -> AuthenticatedUser | None:
    """Validate bearer JWT or API token against configured operational secrets."""
    secret_key = settings.SECRET_KEY.get_secret_value()

    # 1. Attempt standard JWT decode first
    try:
        payload = decode_access_token(token, secret_key)
        sub = str(payload.get("sub", "unknown-user"))
        role_str = str(payload.get("role", "VIEWER")).upper()
        role = UserRole(role_str) if role_str in UserRole._value2member_map_ else UserRole.VIEWER
        return AuthenticatedUser(user_id=sub, role=role, token_type="jwt")
    except UnauthorizedError:
        pass
    except Exception:
        pass

    # 2. Backwards-compatible operational API key fallback for local testing & ingest
    admin_key = settings.ADMIN_API_KEY.get_secret_value()
    dispatcher_key = settings.DISPATCHER_API_KEY.get_secret_value()
    analyst_key = settings.ANALYST_API_KEY.get_secret_value()

    if token == admin_key or token == secret_key:
        return AuthenticatedUser(user_id="operator-admin", role=UserRole.ADMIN, token_type="api_key")
    if token == dispatcher_key:
        return AuthenticatedUser(
            user_id="operator-dispatcher", role=UserRole.DISPATCHER, token_type="api_key"
        )
    if token == analyst_key:
        return AuthenticatedUser(
            user_id="operator-analyst", role=UserRole.ANALYST, token_type="api_key"
        )
    return None


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security_bearer)] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
    settings: Annotated[Settings, Depends(get_settings)] = None,
) -> AuthenticatedUser:
    """Extract and validate current authenticated operator identity."""
    app_settings = settings or get_settings()
    token: str | None = None

    if credentials and credentials.credentials:
        token = credentials.credentials
    elif x_api_key:
        token = x_api_key

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token or X-API-Key header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = authenticate_token(token, app_settings)
    if not user:
        log_with_context(
            logger,
            logging.WARNING,
            "Rejected invalid authentication token",
            context={"token_prefix": token[:4] + "***" if len(token) > 4 else "***"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_auth(
    allowed_roles: Sequence[UserRole | str] | None = None,
) -> Callable[..., AuthenticatedUser]:
    """Dependency factory enforcing mandatory authentication and role-based permissions."""
    expected_roles = [UserRole(r) for r in (allowed_roles or [])]

    def dependency(
        current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    ) -> AuthenticatedUser:
        if not expected_roles:
            return current_user

        user_level = ROLE_HIERARCHY.get(current_user.role, 0)
        has_permission = any(
            user_level >= ROLE_HIERARCHY.get(r, 999) for r in expected_roles
        )

        if not has_permission:
            log_with_context(
                logger,
                logging.WARNING,
                "Access forbidden: User has insufficient role privileges",
                context={
                    "user_id": current_user.user_id,
                    "user_role": current_user.role.value,
                    "required_roles": [r.value for r in expected_roles],
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access forbidden. Role '{current_user.role.value}' is insufficient. "
                    f"Required: {[r.value for r in expected_roles]}"
                ),
            )

        return current_user

    return dependency
