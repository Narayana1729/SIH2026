"""Authentication & Token Issuance Route Handlers (SEC-003)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from packages.config.settings import Settings, get_settings
from services.api.security.auth import AuthenticatedUser, UserRole, get_current_user
from services.api.security.jwt import create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


class TokenRequest(BaseModel):
    """Request payload for issuing a signed JWT access token."""

    user_id: str = Field(..., min_length=3, max_length=64, description="Operator unique username/ID")
    role: UserRole = Field(default=UserRole.VIEWER, description="Requested access role")
    api_key: str = Field(..., description="Operational enrollment secret/key")


class TokenResponse(BaseModel):
    """Access token response containing signed RFC 7519 JWT."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    role: str


@router.post(
    "/token",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Issue signed JWT access token",
)
def issue_token(
    request: TokenRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> TokenResponse:
    """Issue a cryptographically signed JWT access token for authorized operators."""
    # Verify enrollment key against configured operational secrets
    admin_key = settings.ADMIN_API_KEY.get_secret_value()
    dispatcher_key = settings.DISPATCHER_API_KEY.get_secret_value()
    analyst_key = settings.ANALYST_API_KEY.get_secret_value()
    secret_key = settings.SECRET_KEY.get_secret_value()

    # Validate role matches provided key privileges
    valid_key = False
    if request.role in (UserRole.ADMIN, UserRole.SYSTEM_INGESTION) and request.api_key in (
        admin_key,
        secret_key,
    ):
        valid_key = True
    elif request.role == UserRole.DISPATCHER and request.api_key in (
        dispatcher_key,
        admin_key,
        secret_key,
    ):
        valid_key = True
    elif request.role == UserRole.ANALYST and request.api_key in (
        analyst_key,
        dispatcher_key,
        admin_key,
        secret_key,
    ):
        valid_key = True
    elif request.role == UserRole.VIEWER:
        valid_key = True

    if not valid_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid enrollment credentials for requested role.",
        )

    expires_in = 1800  # 30 minutes
    token = create_access_token(
        subject=request.user_id,
        role=request.role.value,
        secret_key=secret_key,
        expires_in_seconds=expires_in,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user_id=request.user_id,
        role=request.role.value,
    )


@router.get(
    "/me",
    response_model=AuthenticatedUser,
    summary="Get current authenticated operator identity",
)
def get_me(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    """Retrieve identity, role, and permissions of active token holder."""
    return current_user
