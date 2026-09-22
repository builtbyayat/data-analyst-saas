"""Configuration for the AI Data Analyst Python analytics engine.

All limits are configurable through environment variables so the worker can run
with conservative defaults locally and be tightened further in production.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default

    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc

    if value < minimum:
        raise ValueError(f"{name} must be >= {minimum}")

    return value


def _env_float(name: str, default: float, minimum: float = 0.0) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default

    try:
        value = float(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number") from exc

    if value < minimum:
        raise ValueError(f"{name} must be >= {minimum}")

    return value


def _env_path(name: str, default: str) -> Path:
    raw = os.getenv(name)
    return Path(raw.strip()) if raw and raw.strip() else Path(default)


@dataclass(frozen=True)
class EngineConfig:
    # Input/result safety limits.
    max_input_rows: int = _env_int("ANALYTICS_MAX_INPUT_ROWS", 500_000)
    max_input_columns: int = _env_int("ANALYTICS_MAX_INPUT_COLUMNS", 200)
    max_output_rows: int = _env_int("ANALYTICS_MAX_OUTPUT_ROWS", 10_000)
    max_output_columns: int = _env_int("ANALYTICS_MAX_OUTPUT_COLUMNS", 100)
    max_output_bytes: int = _env_int(
        "ANALYTICS_MAX_OUTPUT_BYTES",
        5_000_000,
    )

    # Runtime/resource limits.
    request_timeout_seconds: float = _env_float(
        "ANALYTICS_REQUEST_TIMEOUT_SECONDS",
        120.0,
        minimum=0.1,
    )
    max_groupby_groups: int = _env_int(
        "ANALYTICS_MAX_GROUPBY_GROUPS",
        10_000,
    )
    max_correlation_columns: int = _env_int(
        "ANALYTICS_MAX_CORRELATION_COLUMNS",
        50,
    )
    max_percentile_columns: int = _env_int(
        "ANALYTICS_MAX_PERCENTILE_COLUMNS",
        100,
    )

    # Worker/process configuration.
    temp_dir: Path = _env_path(
        "ANALYTICS_TEMP_DIR",
        "/tmp/ai-data-analyst",
    )
    worker_name: str = os.getenv(
        "ANALYTICS_WORKER_NAME",
        "python-analytics-worker",
    )

    # Protocol behavior.
    max_request_bytes: int = _env_int(
        "ANALYTICS_MAX_REQUEST_BYTES",
        1_000_000,
    )
    max_error_message_length: int = _env_int(
        "ANALYTICS_MAX_ERROR_MESSAGE_LENGTH",
        2_000,
    )

    def ensure_temp_dir(self) -> Path:
        """Create and return the worker's temporary directory."""
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        return self.temp_dir


CONFIG = EngineConfig()
