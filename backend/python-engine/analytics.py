"""
Core analytics engine for AI Data Analyst.

Controlled, deterministic analytics operations.
No arbitrary user/model Python execution.

Pipeline:
    validated rows
        ↓
    pandas DataFrame
        ↓
    controlled analytics operation
        ↓
    JSON-safe structured result
"""

from __future__ import annotations

import math
from typing import Any, Callable, Iterable

import numpy as np
import pandas as pd
from scipy import stats

from config import CONFIG
from errors import (
    AnalyticsExecutionError,
    DataError,
    InputLimitError,
    OutputLimitError,
    UnsupportedOperationError,
    ValidationError,
)

Operation = Callable[[pd.DataFrame, dict[str, Any]], dict[str, Any]]


# ---------------------------------------------------------------------------
# JSON safety
# ---------------------------------------------------------------------------

def json_safe(value: Any) -> Any:
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

    if isinstance(value, pd.Timedelta):
        return value.total_seconds()

    if isinstance(value, np.ndarray):
        return [json_safe(item) for item in value.tolist()]

    if isinstance(value, pd.Series):
        return [json_safe(item) for item in value.tolist()]

    if isinstance(value, pd.DataFrame):
        return json_safe(
            value.replace({np.nan: None, pd.NaT: None})
            .to_dict(orient="records")
        )

    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]

    return str(value)


# ---------------------------------------------------------------------------
# DataFrame construction
# ---------------------------------------------------------------------------

def frame_from_rows(rows: Any) -> pd.DataFrame:
    if not isinstance(rows, list):
        raise ValidationError("'rows' must be an array of objects.")

    if len(rows) > CONFIG.max_input_rows:
        raise InputLimitError(
            "Input dataset exceeds the maximum row limit.",
            {"rows": len(rows), "maxRows": CONFIG.max_input_rows},
        )

    if any(not isinstance(row, dict) for row in rows):
        raise ValidationError("Every item in 'rows' must be an object.")

    try:
        frame = pd.DataFrame(rows)
    except Exception as exc:
        raise DataError(
            "Input rows could not be converted into a tabular dataset."
        ) from exc

    if len(frame.columns) > CONFIG.max_input_columns:
        raise InputLimitError(
            "Input dataset exceeds the maximum column limit.",
            {
                "columns": len(frame.columns),
                "maxColumns": CONFIG.max_input_columns,
            },
        )

    return frame


# ---------------------------------------------------------------------------
# Column inference
# ---------------------------------------------------------------------------

DATE_NAME_HINTS = (
    "date",
    "datetime",
    "timestamp",
    "time",
    "created",
    "updated",
    "day",
    "month",
    "year",
)


def _looks_like_date_name(name: str) -> bool:
    lowered = name.strip().lower()
    return any(token in lowered for token in DATE_NAME_HINTS)


def _try_datetime(series: pd.Series) -> tuple[pd.Series | None, float]:
    """
    Safely infer datetime values from strings.

    Returns:
        (converted_series, parse_ratio)
    """
    if pd.api.types.is_datetime64_any_dtype(series):
        return pd.to_datetime(series, errors="coerce"), 1.0

    if pd.api.types.is_numeric_dtype(series):
        return None, 0.0

    non_null = series.dropna()

    if non_null.empty:
        return None, 0.0

    # Avoid turning ordinary categorical strings into dates.
    sample = non_null.astype(str).head(100)

    try:
        converted_sample = pd.to_datetime(
            sample,
            errors="coerce",
            format="mixed",
        )
    except (TypeError, ValueError):
        converted_sample = pd.to_datetime(
            sample,
            errors="coerce",
        )

    ratio = float(converted_sample.notna().mean())

    if ratio < 0.80:
        return None, ratio

    try:
        converted = pd.to_datetime(
            series,
            errors="coerce",
            format="mixed",
        )
    except (TypeError, ValueError):
        converted = pd.to_datetime(
            series,
            errors="coerce",
        )

    full_ratio = float(converted.notna().sum() / max(len(non_null), 1))

    if full_ratio < 0.80:
        return None, full_ratio

    return converted, full_ratio


def infer_column_metadata(frame: pd.DataFrame) -> list[dict[str, Any]]:
    """
    Infer useful semantic types without mutating the source DataFrame.

    Important:
    ISO dates such as 2026-01-01 arrive from JSON as strings, so
    pandas' raw dtype alone is not sufficient.
    """
    metadata: list[dict[str, Any]] = []

    for column in frame.columns:
        name = str(column)
        series = frame[column]

        inferred_type = str(series.dtype)
        semantic_type = "unknown"
        is_numeric = False
        is_datetime = False
        is_categorical = False
        datetime_ratio = 0.0

        if pd.api.types.is_bool_dtype(series):
            semantic_type = "boolean"

        elif pd.api.types.is_numeric_dtype(series):
            semantic_type = "numeric"
            is_numeric = True

        elif pd.api.types.is_datetime64_any_dtype(series):
            semantic_type = "datetime"
            is_datetime = True
            datetime_ratio = 1.0

        else:
            converted, datetime_ratio = _try_datetime(series)

            if converted is not None:
                semantic_type = "datetime"
                is_datetime = True

            else:
                non_null = series.dropna()

                if len(non_null) > 0:
                    unique_ratio = (
                        float(non_null.nunique()) / len(non_null)
                    )

                    if unique_ratio <= 0.20 or len(non_null) <= 20:
                        semantic_type = "categorical"
                        is_categorical = True
                    else:
                        semantic_type = "text"

        metadata.append(
            {
                "name": name,
                "dtype": inferred_type,
                "semanticType": semantic_type,
                "numeric": is_numeric,
                "datetime": is_datetime,
                "categorical": is_categorical,
                "datetimeParseRatio": datetime_ratio,
                "dateNameHint": _looks_like_date_name(name),
                "rows": int(len(series)),
                "nonNull": int(series.notna().sum()),
                "nullCount": int(series.isna().sum()),
                "uniqueCount": int(series.nunique(dropna=True)),
            }
        )

    return metadata


def datetime_columns(frame: pd.DataFrame) -> list[str]:
    columns: list[str] = []

    for column in frame.columns:
        series = frame[column]

        if pd.api.types.is_datetime64_any_dtype(series):
            columns.append(str(column))
            continue

        converted, ratio = _try_datetime(series)

        if converted is not None and ratio >= 0.80:
            columns.append(str(column))

    return columns


def numeric_columns(frame: pd.DataFrame) -> list[str]:
    return [
        str(column)
        for column in frame.select_dtypes(
            include=[np.number]
        ).columns
    ]


def categorical_columns(frame: pd.DataFrame) -> list[str]:
    return [
        str(column)
        for column in frame.columns
        if str(column) not in numeric_columns(frame)
        and str(column) not in datetime_columns(frame)
    ]


# ---------------------------------------------------------------------------
# Column validation
# ---------------------------------------------------------------------------

def require_columns(
    frame: pd.DataFrame,
    columns: Iterable[str],
) -> None:
    requested = list(columns)

    missing = [
        column
        for column in requested
        if column not in frame.columns
    ]

    if missing:
        raise ValidationError(
            "One or more requested columns do not exist.",
            {
                "missingColumns": missing,
                "availableColumns": [
                    str(column) for column in frame.columns
                ],
            },
        )


def require_column(
    frame: pd.DataFrame,
    column: Any,
) -> str:
    if not isinstance(column, str) or not column.strip():
        raise ValidationError("A non-empty column name is required.")

    column = column.strip()
    require_columns(frame, [column])
    return column


def numeric_series(
    frame: pd.DataFrame,
    column: str,
) -> pd.Series:
    column = require_column(frame, column)

    series = pd.to_numeric(
        frame[column],
        errors="coerce",
    ).dropna()

    if series.empty:
        raise DataError(
            f"Column '{column}' does not contain numeric values."
        )

    return series


def datetime_series(
    frame: pd.DataFrame,
    column: str,
) -> pd.Series:
    column = require_column(frame, column)

    series = frame[column]

    if pd.api.types.is_datetime64_any_dtype(series):
        converted = pd.to_datetime(series, errors="coerce")
    else:
        converted, ratio = _try_datetime(series)

        if converted is None or ratio < 0.80:
            raise DataError(
                f"Column '{column}' could not be interpreted as dates."
            )

    if converted.dropna().empty:
        raise DataError(
            f"Column '{column}' does not contain valid dates."
        )

    return converted


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def records(
    frame: pd.DataFrame,
    *,
    max_rows: int | None = None,
) -> list[dict[str, Any]]:
    limit = (
        CONFIG.max_output_rows
        if max_rows is None
        else min(max_rows, CONFIG.max_output_rows)
    )

    if len(frame) > limit:
        raise OutputLimitError(
            "Analytics output exceeds the maximum row limit.",
            {"rows": len(frame), "maxRows": limit},
        )

    cleaned = frame.copy().replace(
        {np.nan: None, pd.NaT: None}
    )

    return json_safe(
        cleaned.to_dict(orient="records")
    )


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

def profile(
    frame: pd.DataFrame,
    _: dict[str, Any],
) -> dict[str, Any]:
    column_profile: list[dict[str, Any]] = []

    for name in frame.columns:
        series = frame[name]
        row_count = len(series)
        non_null = int(series.notna().sum())
        null_count = row_count - non_null

        item: dict[str, Any] = {
            "name": str(name),
            "dtype": str(series.dtype),
            "rows": row_count,
            "nonNull": non_null,
            "nullCount": null_count,
            "nullRate": (
                null_count / row_count
                if row_count
                else 0.0
            ),
            "uniqueCount": int(
                series.nunique(dropna=True)
            ),
        }

        if pd.api.types.is_numeric_dtype(series):
            numeric = pd.to_numeric(
                series,
                errors="coerce",
            ).dropna()

            if not numeric.empty:
                item["statistics"] = {
                    "min": numeric.min(),
                    "max": numeric.max(),
                    "mean": numeric.mean(),
                    "median": numeric.median(),
                    "std": numeric.std(),
                    "variance": numeric.var(),
                }
        else:
            values = (
                series.dropna()
                .astype(str)
                .value_counts()
                .head(10)
            )
            item["topValues"] = values.to_dict()

        column_profile.append(item)

    return {
        "rows": int(len(frame)),
        "columns": int(len(frame.columns)),
        "columnProfile": column_profile,
        "inferredColumns": infer_column_metadata(frame),
    }


# ---------------------------------------------------------------------------
# Descriptive statistics
# ---------------------------------------------------------------------------

def describe(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    columns = args.get("columns")

    if columns is not None:
        if (
            not isinstance(columns, list)
            or not columns
            or not all(
                isinstance(column, str)
                for column in columns
            )
        ):
            raise ValidationError(
                "'columns' must be a non-empty array of strings."
            )

        require_columns(frame, columns)
        target = frame[columns].apply(
            pd.to_numeric,
            errors="coerce",
        )
    else:
        target = frame[numeric_columns(frame)]

    if target.empty:
        raise DataError(
            "No numeric columns are available for descriptive statistics."
        )

    percentiles = args.get(
        "percentiles",
        [0.25, 0.5, 0.75],
    )

    if (
        not isinstance(percentiles, list)
        or any(
            not isinstance(value, (int, float))
            or value < 0
            or value > 1
            for value in percentiles
        )
    ):
        raise ValidationError(
            "Percentiles must be numeric values between 0 and 1."
        )

    described = (
        target
        .describe(percentiles=percentiles)
        .transpose()
        .reset_index()
        .rename(columns={"index": "column"})
    )

    return {
        "statistics": records(described),
    }


# ---------------------------------------------------------------------------
# Percentiles
# ---------------------------------------------------------------------------

def percentiles(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    column = require_column(
        frame,
        args.get("column"),
    )

    requested = args.get(
        "percentiles",
        [25, 50, 75, 90, 95, 99],
    )

    if (
        not isinstance(requested, list)
        or not requested
        or any(
            not isinstance(value, (int, float))
            or value < 0
            or value > 100
            for value in requested
        )
    ):
        raise ValidationError(
            "Percentiles must contain values from 0 to 100."
        )

    series = numeric_series(frame, column)

    values = np.percentile(
        series.to_numpy(),
        requested,
    )

    return {
        "column": column,
        "values": [
            {
                "percentile": percentile,
                "value": value,
            }
            for percentile, value in zip(
                requested,
                values,
            )
        ],
    }


# ---------------------------------------------------------------------------
# Correlation
# ---------------------------------------------------------------------------

def correlation(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    columns = args.get("columns")

    if columns is None:
        columns = numeric_columns(frame)

    if (
        not isinstance(columns, list)
        or len(columns) < 2
        or not all(
            isinstance(column, str)
            for column in columns
        )
    ):
        raise ValidationError(
            "Correlation requires at least two column names."
        )

    if len(columns) > CONFIG.max_correlation_columns:
        raise InputLimitError(
            "Too many columns requested for correlation.",
            {
                "columns": len(columns),
                "maxColumns": CONFIG.max_correlation_columns,
            },
        )

    require_columns(frame, columns)

    method = args.get("method", "pearson")

    if method not in {
        "pearson",
        "spearman",
        "kendall",
    }:
        raise ValidationError(
            "Correlation method must be pearson, spearman, or kendall."
        )

    target = frame[columns].apply(
        pd.to_numeric,
        errors="coerce",
    )

    matrix = target.corr(method=method)

    matrix_records: list[dict[str, Any]] = []

    for left in matrix.index:
        for right in matrix.columns:
            matrix_records.append(
                {
                    "x": str(left),
                    "y": str(right),
                    "correlation": matrix.loc[left, right],
                }
            )

    pairs: list[dict[str, Any]] = []

    for index, left in enumerate(columns):
        for right in columns[index + 1:]:
            value = matrix.loc[left, right]

            if pd.isna(value):
                continue

            pairs.append(
                {
                    "x": left,
                    "y": right,
                    "correlation": value,
                    "absoluteCorrelation": abs(float(value)),
                }
            )

    pairs.sort(
        key=lambda item: item["absoluteCorrelation"],
        reverse=True,
    )

    return {
        "method": method,
        "matrix": matrix_records,
        "pairs": pairs,
    }


# ---------------------------------------------------------------------------
# Outliers
# ---------------------------------------------------------------------------

def outliers(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    column = require_column(
        frame,
        args.get("column"),
    )

    method = args.get("method", "iqr")
    series = numeric_series(frame, column)

    if method == "iqr":
        multiplier = float(
            args.get("multiplier", 1.5)
        )

        if multiplier <= 0:
            raise ValidationError(
                "IQR multiplier must be greater than zero."
            )

        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1

        lower = q1 - multiplier * iqr
        upper = q3 + multiplier * iqr

        mask = (
            (series < lower)
            | (series > upper)
        )

        result = frame.loc[
            series.index[mask]
        ].copy()

        result["_outlierValue"] = series.loc[
            series.index[mask]
        ].values

        return {
            "method": method,
            "column": column,
            "multiplier": multiplier,
            "q1": q1,
            "q3": q3,
            "iqr": iqr,
            "lowerBound": lower,
            "upperBound": upper,
            "count": int(mask.sum()),
            "rate": float(mask.mean()),
            "rows": records(result),
        }

    if method == "zscore":
        threshold = float(
            args.get("threshold", 3.0)
        )

        if threshold <= 0:
            raise ValidationError(
                "Z-score threshold must be greater than zero."
            )

        scores = pd.Series(
            stats.zscore(
                series,
                nan_policy="omit",
            ),
            index=series.index,
        )

        mask = scores.abs() > threshold

        result = frame.loc[
            series.index[mask]
        ].copy()

        result["_zScore"] = scores.loc[
            series.index[mask]
        ].values

        return {
            "method": method,
            "column": column,
            "threshold": threshold,
            "count": int(mask.sum()),
            "rate": float(mask.mean()),
            "rows": records(result),
        }

    raise ValidationError(
        "Outlier method must be 'iqr' or 'zscore'."
    )


# ---------------------------------------------------------------------------
# Groupby
# ---------------------------------------------------------------------------

def groupby_analysis(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    by = args.get("by")
    aggregations = args.get("aggregations")

    if (
        not isinstance(by, list)
        or not by
        or not all(
            isinstance(column, str)
            for column in by
        )
    ):
        raise ValidationError(
            "'by' must be a non-empty array of column names."
        )

    if (
        not isinstance(aggregations, dict)
        or not aggregations
    ):
        raise ValidationError(
            "'aggregations' must be a non-empty object."
        )

    require_columns(frame, by)

    if len(by) > 10:
        raise ValidationError(
            "A maximum of 10 grouping columns is supported."
        )

    allowed = {
        "sum",
        "mean",
        "median",
        "min",
        "max",
        "count",
        "std",
        "var",
    }

    requested: dict[str, list[str]] = {}

    for column, functions in aggregations.items():
        require_column(frame, column)

        if (
            not isinstance(functions, list)
            or not functions
        ):
            raise ValidationError(
                f"Aggregations for '{column}' "
                "must be a non-empty array."
            )

        invalid = [
            function
            for function in functions
            if function not in allowed
        ]

        if invalid:
            raise ValidationError(
                "Unsupported aggregation function(s).",
                {
                    "column": column,
                    "invalid": invalid,
                    "allowed": sorted(allowed),
                },
            )

        requested[column] = functions

    try:
        grouped = (
            frame
            .groupby(by, dropna=False)
            .agg(requested)
            .reset_index()
        )
    except Exception as exc:
        raise AnalyticsExecutionError(
            "Grouped aggregation failed."
        ) from exc

    if len(grouped) > CONFIG.max_groupby_groups:
        raise OutputLimitError(
            "Group-by result contains too many groups.",
            {
                "groups": len(grouped),
                "maxGroups": CONFIG.max_groupby_groups,
            },
        )

    flattened: list[str] = []

    for column in grouped.columns:
        if isinstance(column, tuple):
            flattened.append(
                "_".join(
                    str(part)
                    for part in column
                    if str(part)
                )
            )
        else:
            flattened.append(str(column))

    grouped.columns = flattened

    return {
        "groupBy": by,
        "rows": records(grouped),
    }


# ---------------------------------------------------------------------------
# Controlled transformations
# ---------------------------------------------------------------------------

def transform(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    action = args.get("action")
    output = frame.copy()

    if action == "fill_null":
        column = require_column(
            output,
            args.get("column"),
        )

        if "value" not in args:
            raise ValidationError(
                "'value' is required for fill_null."
            )

        output[column] = output[column].fillna(
            args["value"]
        )

    elif action == "drop_null":
        column = require_column(
            output,
            args.get("column"),
        )

        output = output.dropna(
            subset=[column]
        )

    elif action in {"standardize", "normalize", "log1p", "abs"}:
        column = require_column(
            output,
            args.get("column"),
        )

        values = pd.to_numeric(
            output[column],
            errors="coerce",
        )

        if action == "standardize":
            mean = values.mean()
            std = values.std()

            if pd.isna(std) or std == 0:
                raise DataError(
                    f"Column '{column}' cannot be standardized."
                )

            output[column] = (
                values - mean
            ) / std

        elif action == "normalize":
            minimum = values.min()
            maximum = values.max()

            if (
                pd.isna(minimum)
                or pd.isna(maximum)
                or minimum == maximum
            ):
                raise DataError(
                    f"Column '{column}' cannot be normalized."
                )

            output[column] = (
                values - minimum
            ) / (
                maximum - minimum
            )

        elif action == "log1p":
            if (values.dropna() < 0).any():
                raise DataError(
                    "log1p requires non-negative values."
                )

            output[column] = np.log1p(values)

        else:
            output[column] = values.abs()

    elif action == "sort":
        columns = args.get("columns")

        if (
            not isinstance(columns, list)
            or not columns
            or not all(
                isinstance(column, str)
                for column in columns
            )
        ):
            raise ValidationError(
                "'columns' must be a non-empty array."
            )

        require_columns(output, columns)

        ascending = args.get("ascending", True)

        if isinstance(ascending, bool):
            ascending_value: bool | list[bool] = ascending
        elif (
            isinstance(ascending, list)
            and len(ascending) == len(columns)
            and all(
                isinstance(value, bool)
                for value in ascending
            )
        ):
            ascending_value = ascending
        else:
            raise ValidationError(
                "'ascending' must be a boolean "
                "or matching boolean array."
            )

        output = output.sort_values(
            by=columns,
            ascending=ascending_value,
        )

    elif action == "drop_duplicates":
        columns = args.get("columns")

        if columns is not None:
            if (
                not isinstance(columns, list)
                or not all(
                    isinstance(column, str)
                    for column in columns
                )
            ):
                raise ValidationError(
                    "'columns' must be an array of strings."
                )

            require_columns(output, columns)

        output = output.drop_duplicates(
            subset=columns,
        )

    else:
        raise UnsupportedOperationError(
            f"transform:{action}"
        )

    return {
        "action": action,
        "rows": records(output),
    }


# ---------------------------------------------------------------------------
# Visualization preparation
# ---------------------------------------------------------------------------

def visualization(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    chart_type = args.get("type", "line")

    allowed_types = {
        "line",
        "bar",
        "scatter",
        "pie",
        "area",
    }

    if chart_type not in allowed_types:
        raise ValidationError(
            "Unsupported visualization type.",
            {
                "type": chart_type,
                "allowed": sorted(allowed_types),
            },
        )

    x = require_column(frame, args.get("x"))
    y = require_column(frame, args.get("y"))

    series = args.get("series", [])

    if series is None:
        series = []

    if (
        not isinstance(series, list)
        or not all(
            isinstance(column, str)
            for column in series
        )
    ):
        raise ValidationError(
            "'series' must be an array of column names."
        )

    require_columns(frame, series)

    columns: list[str] = []

    for column in [x, y, *series]:
        if column not in columns:
            columns.append(column)

    selected = frame[columns]

    limit = args.get(
        "limit",
        CONFIG.max_output_rows,
    )

    if not isinstance(limit, int) or limit <= 0:
        raise ValidationError(
            "'limit' must be a positive integer."
        )

    limit = min(
        limit,
        CONFIG.max_output_rows,
    )

    selected = selected.head(limit)

    return {
        "type": chart_type,
        "x": x,
        "y": y,
        "series": series,
        "rowCount": int(len(selected)),
        "data": records(
            selected,
            max_rows=limit,
        ),
    }


# ---------------------------------------------------------------------------
# Trend analysis
# ---------------------------------------------------------------------------

def trend(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    """
    Analyze numeric trend against either a numeric or datetime x-axis.

    Datetime input is converted into elapsed days from the first observation.
    Optional aggregation handles multiple rows for the same date.
    """

    x_column = require_column(
        frame,
        args.get("x"),
    )

    y_column = require_column(
        frame,
        args.get("y"),
    )

    x_raw = frame[x_column]
    y_raw = pd.to_numeric(
        frame[y_column],
        errors="coerce",
    )

    x_datetime, datetime_ratio = _try_datetime(x_raw)

    is_datetime = (
        x_datetime is not None
        and datetime_ratio >= 0.80
    )

    if is_datetime:
        working = pd.DataFrame(
            {
                "_x": x_datetime,
                "_y": y_raw,
            }
        ).dropna()

        working = working.sort_values("_x")

        aggregation = args.get(
            "aggregation",
            "mean",
        )

        if aggregation not in {
            "mean",
            "sum",
            "median",
            "min",
            "max",
        }:
            raise ValidationError(
                "Trend aggregation must be mean, sum, median, min, or max."
            )

        grouped = (
            working
            .groupby("_x", as_index=False)["_y"]
            .agg(aggregation)
            .sort_values("_x")
        )

        if len(grouped) < 2:
            raise DataError(
                "Trend analysis requires at least two valid dates."
            )

        first_date = grouped["_x"].iloc[0]

        x = (
            grouped["_x"] - first_date
        ).dt.total_seconds().to_numpy() / 86400.0

        y = grouped["_y"].to_numpy(dtype=float)

        display_points = pd.DataFrame(
            {
                x_column: grouped["_x"],
                y_column: grouped["_y"],
            }
        )

        x_axis_type = "datetime"
        x_origin = first_date

    else:
        x_numeric = pd.to_numeric(
            x_raw,
            errors="coerce",
        )

        valid = (
            x_numeric.notna()
            & y_raw.notna()
        )

        x = x_numeric[valid].to_numpy(
            dtype=float
        )

        y = y_raw[valid].to_numpy(
            dtype=float
        )

        if len(x) < 2:
            raise DataError(
                "Trend analysis requires at least two valid observations."
            )

        order = np.argsort(x)
        x = x[order]
        y = y[order]

        display_points = pd.DataFrame(
            {
                x_column: x,
                y_column: y,
            }
        )

        x_axis_type = "numeric"
        x_origin = None

    if len(x) < 2:
        raise DataError(
            "Trend analysis requires at least two observations."
        )

    if np.ptp(x) == 0:
        raise DataError(
            f"Column '{x_column}' has no variation."
        )

    result = stats.linregress(x, y)

    slope = float(result.slope)
    intercept = float(result.intercept)
    r_squared = float(result.rvalue ** 2)

    if slope > 0:
        direction = "increasing"
    elif slope < 0:
        direction = "decreasing"
    else:
        direction = "flat"

    predicted = intercept + slope * x
    residuals = y - predicted

    total_variation = float(
        np.sum((y - np.mean(y)) ** 2)
    )

    residual_variation = float(
        np.sum(residuals ** 2)
    )

    if total_variation > 0:
        r_squared_manual = (
            1.0
            - residual_variation / total_variation
        )
    else:
        r_squared_manual = 0.0

    first_value = float(y[0])
    last_value = float(y[-1])
    absolute_change = last_value - first_value

    percent_change = None

    if first_value != 0:
        percent_change = (
            absolute_change
            / abs(first_value)
            * 100.0
        )

    point_records = records(
        display_points,
        max_rows=min(
            len(display_points),
            CONFIG.max_output_rows,
        ),
    )

    output: dict[str, Any] = {
        "x": x_column,
        "y": y_column,
        "xType": x_axis_type,
        "observations": int(len(x)),
        "slope": slope,
        "intercept": intercept,
        "rSquared": r_squared,
        "rSquaredCalculated": r_squared_manual,
        "pValue": float(result.pvalue),
        "standardError": float(result.stderr),
        "direction": direction,
        "firstValue": first_value,
        "lastValue": last_value,
        "absoluteChange": absolute_change,
        "percentChange": percent_change,
        "points": point_records,
    }

    if x_origin is not None:
        output["startDate"] = x_origin
        output["endDate"] = display_points[x_column].iloc[-1]
        output["spanDays"] = float(
            (display_points[x_column].iloc[-1] - x_origin)
            .total_seconds()
            / 86400.0
        )

    return output


# ---------------------------------------------------------------------------
# Distribution analysis
# ---------------------------------------------------------------------------

def distribution(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    """
    Detailed distribution analysis with:
      - descriptive statistics
      - skewness/kurtosis
      - quantiles
      - histogram
      - normality test where statistically appropriate
    """

    column = require_column(
        frame,
        args.get("column"),
    )

    series = numeric_series(
        frame,
        column,
    )

    values = series.to_numpy(
        dtype=float
    )

    if len(values) < 2:
        raise DataError(
            "Distribution analysis requires at least two numeric observations."
        )

    mean = float(np.mean(values))
    median = float(np.median(values))
    std = float(np.std(values, ddof=1))

    variance = float(
        np.var(values, ddof=1)
    )

    minimum = float(np.min(values))
    maximum = float(np.max(values))

    skewness = float(
        stats.skew(
            values,
            bias=False,
        )
    )

    kurtosis = float(
        stats.kurtosis(
            values,
            bias=False,
        )
    )

    quantile_values = {
        "p01": float(np.percentile(values, 1)),
        "p05": float(np.percentile(values, 5)),
        "p10": float(np.percentile(values, 10)),
        "p25": float(np.percentile(values, 25)),
        "p50": float(np.percentile(values, 50)),
        "p75": float(np.percentile(values, 75)),
        "p90": float(np.percentile(values, 90)),
        "p95": float(np.percentile(values, 95)),
        "p99": float(np.percentile(values, 99)),
    }

    # Histogram is intentionally bounded.
    requested_bins = args.get(
        "bins",
        20,
    )

    if (
        not isinstance(requested_bins, int)
        or requested_bins <= 0
    ):
        raise ValidationError(
            "'bins' must be a positive integer."
        )

    bins = min(requested_bins, 50)

    if minimum == maximum:
        edges = np.array(
            [minimum - 0.5, maximum + 0.5]
        )
        counts = np.array([len(values)])
    else:
        counts, edges = np.histogram(
            values,
            bins=bins,
        )

    histogram = []

    for index, count in enumerate(counts):
        histogram.append(
            {
                "binStart": edges[index],
                "binEnd": edges[index + 1],
                "count": int(count),
            }
        )

    normality: dict[str, Any] | None = None

    if 3 <= len(values) <= 5000:
        try:
            result = stats.shapiro(values)

            normality = {
                "test": "shapiro_wilk",
                "statistic": float(result.statistic),
                "pValue": float(result.pvalue),
                "sampleSize": int(len(values)),
            }
        except Exception:
            normality = None

    elif len(values) > 5000:
        try:
            result = stats.normaltest(values)

            normality = {
                "test": "dagostino_pearson",
                "statistic": float(result.statistic),
                "pValue": float(result.pvalue),
                "sampleSize": int(len(values)),
            }
        except Exception:
            normality = None

    return {
        "column": column,
        "count": int(len(values)),
        "mean": mean,
        "median": median,
        "std": std,
        "variance": variance,
        "min": minimum,
        "max": maximum,
        "range": maximum - minimum,
        "skewness": skewness,
        "kurtosis": kurtosis,
        "quantiles": quantile_values,
        "normality": normality,
        "histogram": histogram,
    }


# ---------------------------------------------------------------------------
# Statistical comparison
# ---------------------------------------------------------------------------

def t_test(
    frame: pd.DataFrame,
    args: dict[str, Any],
) -> dict[str, Any]:
    """
    Independent two-sample Welch t-test.

    Required:
        column
        groupColumn

    Optional:
        groupA
        groupB
    """

    column = require_column(
        frame,
        args.get("column"),
    )

    group_column = require_column(
        frame,
        args.get("groupColumn"),
    )

    numeric = pd.to_numeric(
        frame[column],
        errors="coerce",
    )

    valid = frame.copy()
    valid["_numericValue"] = numeric

    valid = valid.dropna(
        subset=[
            "_numericValue",
            group_column,
        ]
    )

    groups = list(
        valid[group_column]
        .drop_duplicates()
    )

    group_a = args.get(
        "groupA",
        groups[0] if len(groups) > 0 else None,
    )

    group_b = args.get(
        "groupB",
        groups[1] if len(groups) > 1 else None,
    )

    if group_a is None or group_b is None:
        raise DataError(
            "t-test requires two distinct groups."
        )

    if group_a == group_b:
        raise ValidationError(
            "groupA and groupB must be different."
        )

    values_a = valid.loc[
        valid[group_column] == group_a,
        "_numericValue",
    ].to_numpy(dtype=float)

    values_b = valid.loc[
        valid[group_column] == group_b,
        "_numericValue",
    ].to_numpy(dtype=float)

    if len(values_a) < 2 or len(values_b) < 2:
        raise DataError(
            "Each group needs at least two numeric observations."
        )

    result = stats.ttest_ind(
        values_a,
        values_b,
        equal_var=False,
    )

    mean_a = float(np.mean(values_a))
    mean_b = float(np.mean(values_b))

    variance_a = float(
        np.var(values_a, ddof=1)
    )
    variance_b = float(
        np.var(values_b, ddof=1)
    )

    # Cohen's d using pooled standard deviation.
    pooled_variance = (
        (
            (len(values_a) - 1) * variance_a
            + (len(values_b) - 1) * variance_b
        )
        / (
            len(values_a)
            + len(values_b)
            - 2
        )
    )

    pooled_std = math.sqrt(
        pooled_variance
    ) if pooled_variance > 0 else 0.0

    cohen_d = (
        (mean_a - mean_b) / pooled_std
        if pooled_std > 0
        else None
    )

    difference = mean_a - mean_b

    return {
        "test": "welch_t_test",
        "column": column,
        "groupColumn": group_column,
        "groupA": json_safe(group_a),
        "groupB": json_safe(group_b),
        "sampleSizes": {
            "groupA": int(len(values_a)),
            "groupB": int(len(values_b)),
        },
        "means": {
            "groupA": mean_a,
            "groupB": mean_b,
        },
        "differenceInMeans": difference,
        "standardDeviations": {
            "groupA": float(np.std(values_a, ddof=1)),
            "groupB": float(np.std(values_b, ddof=1)),
        },
        "statistic": float(result.statistic),
        "pValue": float(result.pvalue),
        "degreesOfFreedom": float(
            result.df
        ) if hasattr(result, "df") else None,
        "effectSize": {
            "name": "cohens_d",
            "value": cohen_d,
        },
    }


# ---------------------------------------------------------------------------
# Operation registry
# ---------------------------------------------------------------------------

OPERATIONS: dict[str, Operation] = {
    "profile": profile,
    "describe": describe,
    "percentiles": percentiles,
    "correlation": correlation,
    "outliers": outliers,
    "groupby": groupby_analysis,
    "transform": transform,
    "visualization": visualization,
    "trend": trend,
    "distribution": distribution,
    "t_test": t_test,
}


def available_operations() -> list[str]:
    return sorted(OPERATIONS.keys())


# ---------------------------------------------------------------------------
# Public execution API
# ---------------------------------------------------------------------------

def analyze(
    rows: Any,
    operation: str,
    args: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not isinstance(operation, str):
        raise ValidationError(
            "'operation' must be a string."
        )

    operation = operation.strip()

    if operation not in OPERATIONS:
        raise UnsupportedOperationError(
            operation
        )

    if args is None:
        args = {}

    if not isinstance(args, dict):
        raise ValidationError(
            "'args' must be an object."
        )

    frame = frame_from_rows(rows)

    try:
        result = OPERATIONS[operation](
            frame,
            args,
        )
    except (
        ValidationError,
        InputLimitError,
        OutputLimitError,
        DataError,
        UnsupportedOperationError,
        AnalyticsExecutionError,
    ):
        raise
    except Exception as exc:
        raise AnalyticsExecutionError(
            f"Analytics operation '{operation}' failed."
        ) from exc

    return {
        "operation": operation,
        "result": json_safe(result),
    }