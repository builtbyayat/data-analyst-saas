"""Structured errors for the AI Data Analyst Python analytics engine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class AnalyticsError(Exception):
    """Base structured error returned by the analytics engine."""

    code: str
    message: str
    details: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
        }

        if self.details:
            result["details"] = self.details

        return result


class ValidationError(AnalyticsError):
    """Raised when an analytics request is invalid."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            details=details,
        )


class UnsupportedOperationError(AnalyticsError):
    """Raised when the requested analytics operation is unsupported."""

    def __init__(
        self,
        operation: str,
    ) -> None:
        super().__init__(
            code="UNSUPPORTED_OPERATION",
            message=f"Unsupported analytics operation: {operation}",
            details={"operation": operation},
        )


class InputLimitError(AnalyticsError):
    """Raised when an input dataset exceeds configured limits."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code="INPUT_LIMIT_EXCEEDED",
            message=message,
            details=details,
        )


class OutputLimitError(AnalyticsError):
    """Raised when an analytics result exceeds configured limits."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code="OUTPUT_LIMIT_EXCEEDED",
            message=message,
            details=details,
        )


class DataError(AnalyticsError):
    """Raised when the input data cannot be analyzed safely."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code="DATA_ERROR",
            message=message,
            details=details,
        )


class AnalyticsExecutionError(AnalyticsError):
    """Raised when an analytics operation fails during execution."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code="ANALYTICS_EXECUTION_ERROR",
            message=message,
            details=details,
        )


class RequestTimeoutError(AnalyticsError):
    """Raised when an analytics request exceeds its execution time."""

    def __init__(
        self,
        timeout_seconds: float,
    ) -> None:
        super().__init__(
            code="REQUEST_TIMEOUT",
            message=(
                "Analytics request exceeded the configured timeout "
                f"of {timeout_seconds:g} seconds."
            ),
            details={
                "timeoutSeconds": timeout_seconds,
            },
        )


class ProtocolError(AnalyticsError):
    """Raised when worker input/output protocol data is invalid."""

    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code="PROTOCOL_ERROR",
            message=message,
            details=details,
        )


def normalize_exception(
    error: Exception,
    *,
    fallback_code: str = "INTERNAL_ERROR",
) -> dict[str, Any]:
    """Convert any exception into the worker's structured error format."""

    if isinstance(error, AnalyticsError):
        return error.to_dict()

    return {
        "code": fallback_code,
        "message": str(error) or error.__class__.__name__,
        "details": {
            "exceptionType": error.__class__.__name__,
        },
    }