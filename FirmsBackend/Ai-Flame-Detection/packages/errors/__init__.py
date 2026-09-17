"""Canonical application error and exception package for SIH26162.

Provides the base AppError, ErrorCode enumeration, and categorized exception classes
for configuration, validation, database, external dependencies, domain invariants,
and background processing pipelines.
"""

from packages.errors.base import AppError
from packages.errors.codes import ErrorCode
from packages.errors.exceptions import (
    ConfigurationError,
    ConflictError,
    ContractViolationError,
    DatabaseConnectionError,
    DatabaseError,
    DomainError,
    ExternalServiceError,
    ForbiddenError,
    InvalidConfigurationError,
    InvalidCoordinateError,
    InvalidJobStateTransitionError,
    InvariantViolationError,
    JobBlockedError,
    JobCancelledError,
    JobExecutionError,
    MissingConfigurationError,
    NotFoundError,
    PipelineError,
    ServiceTimeoutError,
    ServiceUnavailableError,
    UnauthorizedError,
    ValidationError,
)

__all__ = [
    "AppError",
    "ConfigurationError",
    "ConflictError",
    "ContractViolationError",
    "DatabaseConnectionError",
    "DatabaseError",
    "DomainError",
    "ErrorCode",
    "ExternalServiceError",
    "ForbiddenError",
    "InvalidConfigurationError",
    "InvalidCoordinateError",
    "InvalidJobStateTransitionError",
    "InvariantViolationError",
    "JobBlockedError",
    "JobCancelledError",
    "JobExecutionError",
    "MissingConfigurationError",
    "NotFoundError",
    "PipelineError",
    "ServiceTimeoutError",
    "ServiceUnavailableError",
    "UnauthorizedError",
    "ValidationError",
]
