#!/usr/bin/env python3
"""AI Data Analyst - Python Analytics Engine worker.

JSON Lines worker used by the NestJS backend.

The worker exposes only controlled analytics operations.
It never executes arbitrary Python supplied by a user or AI-generated request.
"""

from __future__ import annotations

import json
import math
import os
import sys
import traceback
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from analytics import (
    analyze,
    available_operations,
    infer_column_metadata,
)
from planner import plan_analysis, result_to_dict


ENGINE_NAME = "ai-data-analyst-python"
ENGINE_VERSION = "0.4.1"

MAX_ROWS = int(
    os.getenv("ANALYTICS_MAX_ROWS", "500000")
)
MAX_COLUMNS = int(
    os.getenv("ANALYTICS_MAX_COLUMNS", "200")
)
MAX_OUTPUT_ROWS = int(
    os.getenv("ANALYTICS_MAX_OUTPUT_ROWS", "10000")
)
MAX_REQUEST_BYTES = int(
    os.getenv(
        "ANALYTICS_MAX_REQUEST_BYTES",
        str(5 * 1024 * 1024),
    )
)


class AnalyticsError(Exception):
    """Expected user-facing analytics error."""


@dataclass(frozen=True)
class AnalyticsContext:
    request_id: str
    operation: str


def _json_safe(value: Any) -> Any:
    """Convert numpy/pandas values into JSON-compatible primitives."""

    if value is None:
        return None

    if isinstance(value, (str, bool, int)):
        return value

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    if isinstance(value, np.integer):
        return int(value)

    if isinstance(value, np.floating):
        number = float(value)
        return number if math.isfinite(number) else None

    if isinstance(value, np.bool_):
        return bool(value)

    if isinstance(value, pd.Timestamp):
        return value.isoformat()

    if isinstance(value, np.ndarray):
        return [
            _json_safe(item)
            for item in value.tolist()
        ]

    if isinstance(value, (list, tuple)):
        return [
            _json_safe(item)
            for item in value
        ]

    if isinstance(value, dict):
        return {
            str(key): _json_safe(item)
            for key, item in value.items()
        }

    return str(value)


def _frame_from_rows(
    rows: Any,
) -> pd.DataFrame:
    """Build a validated DataFrame from request rows."""

    if not isinstance(rows, list):
        raise AnalyticsError(
            "'rows' must be an array of objects."
        )

    if len(rows) > MAX_ROWS:
        raise AnalyticsError(
            f"input contains too many rows "
            f"(max {MAX_ROWS})."
        )

    if any(
        not isinstance(row, dict)
        for row in rows
    ):
        raise AnalyticsError(
            "every item in 'rows' must be an object."
        )

    frame = pd.DataFrame(rows)

    if len(frame.columns) > MAX_COLUMNS:
        raise AnalyticsError(
            f"input contains too many columns "
            f"(max {MAX_COLUMNS})."
        )

    return frame


def _frame_to_rows(
    frame: pd.DataFrame,
) -> list[dict[str, Any]]:
    """Convert a DataFrame into analytics-engine input."""

    if len(frame) > MAX_ROWS:
        raise AnalyticsError(
            f"analytics input contains too many rows "
            f"(max {MAX_ROWS})."
        )

    records = frame.to_dict(
        orient="records"
    )

    return _json_safe(records)


def _column_metadata(
    frame: pd.DataFrame,
) -> list[dict[str, Any]]:
    """Use shared analytics metadata inference."""

    try:
        metadata = infer_column_metadata(
            frame
        )
    except Exception as exc:
        raise AnalyticsError(
            f"failed to infer column metadata: {exc}"
        ) from exc

    return _json_safe(metadata)


def _available_operations() -> list[str]:
    """Return operations exposed by analytics.py."""

    try:
        operations = available_operations()

        if isinstance(operations, dict):
            operations = operations.keys()

        return sorted(
            {
                str(operation)
                for operation in operations
            }
        )

    except Exception:
        # Keep the worker introspection endpoint
        # useful even if an older analytics module
        # does not expose available_operations().
        return [
            "profile",
            "describe",
            "percentiles",
            "correlation",
            "outliers",
            "groupby",
            "transform",
            "visualization",
            "trend",
            "distribution",
            "t_test",
        ]


OPERATIONS = set(
    _available_operations()
)


def _execute_operation(
    frame: pd.DataFrame,
    operation: str,
    args: dict[str, Any],
) -> dict[str, Any]:
    """Execute one controlled analytics operation.

    Important:
    analytics.analyze() currently accepts rows,
    not a pandas DataFrame. The worker keeps the
    DataFrame internally and converts it at this
    boundary.
    """

    if operation not in OPERATIONS:
        raise AnalyticsError(
            f"operation '{operation}' is not "
            f"available in this worker. "
            f"Available: "
            f"{', '.join(sorted(OPERATIONS))}"
        )

    rows = _frame_to_rows(frame)

    try:
        result = analyze(
            rows,
            operation,
            args,
        )

    except AnalyticsError:
        raise

    except Exception as exc:
        raise AnalyticsError(
            str(exc)
        ) from exc

    if isinstance(result, dict):
        return _json_safe(result)

    return {
        "value": _json_safe(result)
    }


def _execute_planned_analysis(
    frame: pd.DataFrame,
    question: str,
    columns: list[dict[str, Any]],
) -> dict[str, Any]:
    """Plan and execute controlled analytics operations."""

    planner_result = plan_analysis(
        question,
        columns,
        max_plans=8,
    )

    execution_results: list[
        dict[str, Any]
    ] = []

    for plan in planner_result.plans:
        operation = plan.operation

        try:
            result = _execute_operation(
                frame,
                operation,
                plan.args,
            )

            execution_results.append(
                {
                    "operation": operation,
                    "status": "success",
                    "confidence": plan.confidence,
                    "reason": plan.reason,
                    "args": plan.args,
                    "result": result,
                }
            )

        except Exception as exc:
            execution_results.append(
                {
                    "operation": operation,
                    "status": "error",
                    "confidence": plan.confidence,
                    "reason": plan.reason,
                    "args": plan.args,
                    "error": {
                        "code": (
                            "ANALYTICS_OPERATION_ERROR"
                        ),
                        "message": str(exc),
                    },
                }
            )

    planner_dict = result_to_dict(
        planner_result
    )

    planned_operations = {
        plan.operation
        for plan in planner_result.plans
    }

    filtered_warnings: list[str] = []

    for warning in planner_dict.get(
        "warnings",
        [],
    ):
        warning_text = str(
            warning
        ).lower()

        # Do not report a generic correlation
        # warning when correlation was not requested.
        if (
            "correlation" in warning_text
            and "correlation"
            not in planned_operations
        ):
            continue

        # Do not report missing time-series
        # warnings when trend was successfully planned.
        if (
            "time-series" in warning_text
            and "trend" in planned_operations
        ):
            continue

        filtered_warnings.append(
            str(warning)
        )

    planner_dict["warnings"] = (
        filtered_warnings
    )

    return {
        "question": question,
        "columns": _json_safe(columns),
        "planner": planner_dict,
        "results": execution_results,
    }


def _validate_request(
    request: Any,
) -> dict[str, Any]:
    if not isinstance(request, dict):
        raise AnalyticsError(
            "request must be an object."
        )

    request_id = request.get(
        "requestId"
    )

    if (
        not isinstance(request_id, str)
        or not request_id.strip()
    ):
        raise AnalyticsError(
            "requestId is required."
        )

    return request


def handle(
    request: dict[str, Any],
) -> dict[str, Any]:
    """Handle one JSON request."""

    request = _validate_request(
        request
    )

    request_id = request[
        "requestId"
    ]
    operation = request.get(
        "operation"
    )

    # ---------------------------------------------------------
    # Health check
    # ---------------------------------------------------------

    if operation == "ping":
        return {
            "ok": True,
            "engine": ENGINE_NAME,
            "version": ENGINE_VERSION,
            "requestId": request_id,
            "operation": "ping",
            "result": {
                "worker": ENGINE_NAME,
                "status": "ready",
            },
        }

    # ---------------------------------------------------------
    # Operation introspection
    # ---------------------------------------------------------

    if operation == "operations":
        return {
            "ok": True,
            "engine": ENGINE_NAME,
            "version": ENGINE_VERSION,
            "requestId": request_id,
            "operation": "operations",
            "result": {
                "operations": sorted(
                    OPERATIONS
                ),
                "planner": True,
            },
        }

    # ---------------------------------------------------------
    # Input rows
    # ---------------------------------------------------------

    rows = request.get(
        "rows"
    )

    # Backward compatibility with
    # the old "data" property.
    if rows is None:
        rows = request.get(
            "data"
        )

    frame = _frame_from_rows(
        rows
    )

    # ---------------------------------------------------------
    # Natural-language planner mode
    # ---------------------------------------------------------

    question = request.get(
        "question"
    )

    if (
        isinstance(question, str)
        and question.strip()
    ):
        supplied_columns = request.get(
            "columns"
        )

        if isinstance(
            supplied_columns,
            list,
        ):
            columns = supplied_columns
        else:
            columns = _column_metadata(
                frame
            )

        planned = (
            _execute_planned_analysis(
                frame,
                question.strip(),
                columns,
            )
        )

        return {
            "ok": True,
            "engine": ENGINE_NAME,
            "version": ENGINE_VERSION,
            "requestId": request_id,
            "operation": "plan",
            "result": _json_safe(
                planned
            ),
        }

    # ---------------------------------------------------------
    # Direct operation mode
    # ---------------------------------------------------------

    if (
        not isinstance(
            operation,
            str,
        )
        or not operation.strip()
    ):
        raise AnalyticsError(
            "operation or question is required."
        )

    operation = operation.strip()

    if operation not in OPERATIONS:
        raise AnalyticsError(
            f"unsupported operation "
            f"'{operation}'. "
            f"Available: "
            f"{', '.join(sorted(OPERATIONS))}"
        )

    args = request.get(
        "args"
    )

    if args is None:
        args = {}

    if not isinstance(
        args,
        dict,
    ):
        raise AnalyticsError(
            "'args' must be an object."
        )

    context = AnalyticsContext(
        request_id=request_id,
        operation=operation,
    )

    result = _execute_operation(
        frame,
        operation,
        args,
    )

    return {
        "ok": True,
        "engine": ENGINE_NAME,
        "version": ENGINE_VERSION,
        "requestId": context.request_id,
        "operation": context.operation,
        "result": _json_safe(
            result
        ),
    }


def emit(
    payload: dict[str, Any],
) -> None:
    """Write exactly one JSON response line."""

    encoded = json.dumps(
        _json_safe(payload),
        separators=(",", ":"),
        ensure_ascii=False,
    )

    sys.stdout.write(
        encoded + "\n"
    )
    sys.stdout.flush()


def _read_request_line(
    raw_line: str,
) -> dict[str, Any]:
    """Parse and validate one JSONL request."""

    line = raw_line.strip()

    if not line:
        raise AnalyticsError(
            "empty request."
        )

    request_size = len(
        line.encode("utf-8")
    )

    if request_size > MAX_REQUEST_BYTES:
        raise AnalyticsError(
            f"request is too large "
            f"(max {MAX_REQUEST_BYTES} bytes)."
        )

    try:
        parsed = json.loads(
            line
        )
    except json.JSONDecodeError as exc:
        raise AnalyticsError(
            f"invalid JSON: {exc}"
        ) from exc

    return parsed


def main() -> int:
    """Run the JSONL worker."""

    for raw_line in sys.stdin:
        try:
            request = _read_request_line(
                raw_line
            )

            response = handle(
                request
            )

            emit(response)

        except AnalyticsError as exc:
            emit(
                {
                    "ok": False,
                    "error": {
                        "code": (
                            "ANALYTICS_ERROR"
                        ),
                        "message": str(exc),
                    },
                }
            )

        except Exception as exc:
            emit(
                {
                    "ok": False,
                    "error": {
                        "code": "ENGINE_ERROR",
                        "message": str(exc),
                        "trace": traceback.format_exc(
                            limit=5
                        ),
                    },
                }
            )

    return 0


if __name__ == "__main__":
    raise SystemExit(
        main()
    )