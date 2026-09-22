"""JSONL protocol for communication with the Python analytics worker.

The worker communicates through stdin/stdout using one JSON object per line.

Request:
    {
        "requestId": "req-123",
        "operation": "profile",
        "data": [...]
    }

Response:
    {
        "requestId": "req-123",
        "status": "success",
        "result": {...}
    }

Errors are returned as structured JSON and never as raw Python tracebacks.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from typing import Any, TextIO

from config import CONFIG
from errors import AnalyticsError, ProtocolError, normalize_exception


@dataclass(frozen=True)
class WorkerRequest:
    """Validated analytics worker request."""

    request_id: str
    operation: str
    payload: dict[str, Any]


def _ensure_object(value: Any, field_name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProtocolError(
            f"{field_name} must be a JSON object.",
            details={
                "field": field_name,
                "receivedType": type(value).__name__,
            },
        )

    return value


def _ensure_non_empty_string(
    value: Any,
    field_name: str,
) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ProtocolError(
            f"{field_name} must be a non-empty string.",
            details={
                "field": field_name,
            },
        )

    return value.strip()


def parse_request(raw_line: str) -> WorkerRequest:
    """Parse and validate one JSONL request."""

    if not raw_line.strip():
        raise ProtocolError("Request line is empty.")

    raw_bytes = raw_line.encode("utf-8")

    if len(raw_bytes) > CONFIG.max_request_bytes:
        raise ProtocolError(
            "Request exceeds the maximum allowed size.",
            details={
                "maxRequestBytes": CONFIG.max_request_bytes,
                "requestBytes": len(raw_bytes),
            },
        )

    try:
        decoded = json.loads(raw_line)
    except json.JSONDecodeError as exc:
        raise ProtocolError(
            "Request contains invalid JSON.",
            details={
                "line": exc.lineno,
                "column": exc.colno,
            },
        ) from exc

    request = _ensure_object(decoded, "Request")

    request_id = _ensure_non_empty_string(
        request.get("requestId"),
        "requestId",
    )

    operation = _ensure_non_empty_string(
        request.get("operation"),
        "operation",
    )

    payload = {
        key: value
        for key, value in request.items()
        if key not in {"requestId", "operation"}
    }

    return WorkerRequest(
        request_id=request_id,
        operation=operation,
        payload=payload,
    )


def build_success_response(
    request_id: str,
    result: Any,
) -> dict[str, Any]:
    """Build a successful worker response."""

    return {
        "requestId": request_id,
        "status": "success",
        "result": result,
    }


def build_error_response(
    request_id: str | None,
    error: Exception,
) -> dict[str, Any]:
    """Build a safe structured error response."""

    normalized = normalize_exception(error)

    message = normalized.get("message", "Internal error.")

    if not isinstance(message, str):
        message = "Internal error."

    normalized["message"] = message[
        : CONFIG.max_error_message_length
    ]

    response: dict[str, Any] = {
        "requestId": request_id,
        "status": "error",
        "error": normalized,
    }

    return response


def serialize_response(response: dict[str, Any]) -> str:
    """Serialize one response into a compact JSON line."""

    try:
        encoded = json.dumps(
            response,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        fallback = build_error_response(
            response.get("requestId"),
            AnalyticsError(
                code="SERIALIZATION_ERROR",
                message="Analytics result could not be serialized.",
            ),
        )

        try:
            encoded = json.dumps(
                fallback,
                ensure_ascii=False,
                separators=(",", ":"),
                allow_nan=False,
            )
        except Exception as fallback_error:
            raise ProtocolError(
                "Failed to serialize worker response."
            ) from fallback_error

        # Keep the original serialization failure from being silently ignored.
        _ = exc

    encoded_bytes = encoded.encode("utf-8")

    if len(encoded_bytes) > CONFIG.max_output_bytes:
        request_id = response.get("requestId")

        overflow_response = build_error_response(
            request_id if isinstance(request_id, str) else None,
            AnalyticsError(
                code="OUTPUT_LIMIT_EXCEEDED",
                message="Worker response exceeds the maximum output size.",
                details={
                    "maxOutputBytes": CONFIG.max_output_bytes,
                    "responseBytes": len(encoded_bytes),
                },
            ),
        )

        encoded = json.dumps(
            overflow_response,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        )

    return encoded


def write_response(
    response: dict[str, Any],
    output: TextIO = sys.stdout,
) -> None:
    """Write exactly one JSON response line to stdout."""

    line = serialize_response(response)

    output.write(line)
    output.write("\n")
    output.flush()


def read_requests(
    input_stream: TextIO = sys.stdin,
):
    """Yield raw JSONL request lines from stdin."""

    for line in input_stream:
        yield line.rstrip("\r\n")


def protocol_error_response(
    error: Exception,
) -> dict[str, Any]:
    """Create an error response when requestId cannot be recovered."""

    return build_error_response(None, error)