"""
Analytics planner for AI Data Analyst.

Converts a natural-language analytics request into a small,
controlled set of deterministic analytics operations.

The planner NEVER generates or executes Python.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any


SUPPORTED_OPERATIONS = {
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
}


@dataclass
class ColumnInfo:
    name: str
    dtype: str = "unknown"
    semanticType: str = "unknown"
    numeric: bool = False
    datetime: bool = False
    categorical: bool = False


@dataclass
class AnalyticsPlan:
    operation: str
    args: dict[str, Any]
    confidence: float
    reason: str


@dataclass
class PlannerResult:
    question: str
    plans: list[AnalyticsPlan]
    warnings: list[str]


def _normalize(value: Any) -> str:
    return str(value or "").strip().lower()


def _tokens(value: Any) -> set[str]:
    return set(
        re.findall(
            r"[a-z0-9_]+",
            _normalize(value),
        )
    )


def _contains_any(
    text: str,
    phrases: list[str],
) -> bool:
    normalized = _normalize(text)
    return any(
        phrase in normalized
        for phrase in phrases
    )


def _contains_token(
    text: str,
    token: str,
) -> bool:
    return token in _tokens(text)


def normalize_columns(
    columns: list[dict[str, Any]],
) -> list[ColumnInfo]:
    result: list[ColumnInfo] = []

    for column in columns:
        result.append(
            ColumnInfo(
                name=str(column.get("name", "")),
                dtype=str(
                    column.get(
                        "dtype",
                        "unknown",
                    )
                ),
                semanticType=str(
                    column.get(
                        "semanticType",
                        "unknown",
                    )
                ),
                numeric=bool(
                    column.get("numeric", False)
                ),
                datetime=bool(
                    column.get("datetime", False)
                ),
                categorical=bool(
                    column.get(
                        "categorical",
                        False,
                    )
                ),
            )
        )

    return [
        column
        for column in result
        if column.name
    ]


def _numeric_columns(
    columns: list[ColumnInfo],
) -> list[ColumnInfo]:
    return [
        column
        for column in columns
        if column.numeric
    ]


def _datetime_columns(
    columns: list[ColumnInfo],
) -> list[ColumnInfo]:
    return [
        column
        for column in columns
        if column.datetime
    ]


def _categorical_columns(
    columns: list[ColumnInfo],
) -> list[ColumnInfo]:
    return [
        column
        for column in columns
        if column.categorical
    ]


def _find_column(
    columns: list[ColumnInfo],
    text: str,
    *,
    numeric: bool = False,
    datetime: bool = False,
) -> ColumnInfo | None:
    normalized = _normalize(text)

    candidates = columns

    if numeric:
        candidates = _numeric_columns(
            candidates
        )

    if datetime:
        candidates = _datetime_columns(
            candidates
        )

    if not candidates:
        return None

    # Exact name match.
    for column in candidates:
        if _normalize(column.name) == normalized:
            return column

    # Token/name match.
    requested_tokens = _tokens(text)

    for column in candidates:
        column_tokens = _tokens(
            column.name
        )

        if requested_tokens & column_tokens:
            return column

    return candidates[0]


def _find_group_column(
    columns: list[ColumnInfo],
) -> ColumnInfo | None:
    categorical = _categorical_columns(
        columns
    )

    if categorical:
        return categorical[0]

    non_numeric = [
        column
        for column in columns
        if not column.numeric
        and not column.datetime
    ]

    return (
        non_numeric[0]
        if non_numeric
        else None
    )


def _plan_describe(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    if not _contains_any(
        question,
        [
            "describe",
            "descriptive",
            "statistics",
            "summary statistics",
            "summary",
            "stats",
        ],
    ):
        return None

    numeric = _numeric_columns(columns)

    if not numeric:
        return None

    return AnalyticsPlan(
        operation="describe",
        args={
            "columns": [
                column.name
                for column in numeric
            ]
        },
        confidence=0.94,
        reason=(
            "The question asks for descriptive "
            "statistics."
        ),
    )


def _plan_correlation(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    if not _contains_any(
        question,
        [
            "correlation",
            "correlated",
            "relationship between",
            "relationship among",
            "association",
        ],
    ):
        return None

    numeric = _numeric_columns(columns)

    if len(numeric) < 2:
        return None

    return AnalyticsPlan(
        operation="correlation",
        args={
            "columns": [
                column.name
                for column in numeric
            ]
        },
        confidence=0.97,
        reason=(
            "The question explicitly asks for "
            "relationships between numeric measures."
        ),
    )


def _plan_percentiles(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    if not _contains_any(
        question,
        [
            "percentile",
            "percentiles",
            "p95",
            "p90",
            "p99",
            "quantile",
            "quantiles",
        ],
    ):
        return None

    numeric = _numeric_columns(columns)

    if not numeric:
        return None

    return AnalyticsPlan(
        operation="percentiles",
        args={
            "column": numeric[0].name,
            "percentiles": [
                25,
                50,
                75,
                90,
                95,
                99,
            ],
        },
        confidence=0.95,
        reason=(
            "The question asks for percentile "
            "or quantile analysis."
        ),
    )


def _plan_outliers(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    if not _contains_any(
        question,
        [
            "outlier",
            "outliers",
            "anomaly",
            "anomalies",
            "unusual",
            "abnormal",
        ],
    ):
        return None

    numeric = _numeric_columns(columns)

    if not numeric:
        return None

    method = "zscore" if _contains_any(
        question,
        [
            "z-score",
            "zscore",
            "standard deviation",
            "std deviation",
        ],
    ) else "iqr"

    args: dict[str, Any] = {
        "column": numeric[0].name,
        "method": method,
    }

    if method == "iqr":
        args["multiplier"] = 1.5
    else:
        args["threshold"] = 3.0

    return AnalyticsPlan(
        operation="outliers",
        args=args,
        confidence=0.98,
        reason=(
            "The question explicitly asks for "
            "unusual or anomalous observations."
        ),
    )


def _plan_trend(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    if not _contains_any(
        question,
        [
            "trend",
            "trends",
            "over time",
            "time series",
            "growth over time",
            "change over time",
            "increase over time",
            "decrease over time",
        ],
    ):
        return None

    dates = _datetime_columns(columns)
    numeric = _numeric_columns(columns)

    if not dates or not numeric:
        return None

    date_column = dates[0]
    value_column = numeric[0]

    return AnalyticsPlan(
        operation="trend",
        args={
            "x": date_column.name,
            "y": value_column.name,
        },
        confidence=0.97,
        reason=(
            "A time-like column and numeric "
            "measure are available for trend analysis."
        ),
    )


def _plan_distribution(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    if not _contains_any(
        question,
        [
            "distribution",
            "distributed",
            "skew",
            "skewness",
            "kurtosis",
            "normality",
            "normally distributed",
            "histogram",
        ],
    ):
        return None

    numeric = _numeric_columns(columns)

    if not numeric:
        return None

    return AnalyticsPlan(
        operation="distribution",
        args={
            "column": numeric[0].name,
            "bins": 20,
        },
        confidence=0.95,
        reason=(
            "The question asks for distribution "
            "or shape analysis."
        ),
    )


def _plan_groupby(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    if not _contains_any(
        question,
        [
            "by ",
            "per ",
            "group by",
            "grouped by",
            "breakdown",
            "break down",
            "compare by",
        ],
    ):
        return None

    group_column = _find_group_column(
        columns
    )
    numeric = _numeric_columns(columns)

    if not group_column or not numeric:
        return None

    return AnalyticsPlan(
        operation="groupby",
        args={
            "by": [
                group_column.name
            ],
            "aggregations": {
                numeric[0].name: [
                    "sum",
                    "mean",
                ]
            },
        },
        confidence=0.88,
        reason=(
            "The question suggests comparing "
            "a numeric measure across groups."
        ),
    )


def _plan_t_test(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    if not _contains_any(
        question,
        [
            "t-test",
            "t test",
            "welch",
            "statistical significance between",
            "significant difference between",
            "compare between",
            "difference between",
        ],
    ):
        return None

    numeric = _numeric_columns(columns)
    group = _find_group_column(columns)

    if not numeric or not group:
        return None

    value_column = _find_column(
        numeric,
        question,
        numeric=True,
    )

    if value_column is None:
        value_column = numeric[0]

    args: dict[str, Any] = {
        "column": value_column.name,
        "groupColumn": group.name,
    }

    normalized_question = _normalize(
        question
    )

    # Examples:
    # "compare sales between regions A and B"
    # "compare sales between north and south"
    between_match = re.search(
        r"\bbetween\s+(.+?)\s+and\s+(.+?)(?:\s*$|\s+for\s+|\s+using\s+)",
        normalized_question,
    )

    if between_match:
        group_a = between_match.group(1).strip()
        group_b = between_match.group(2).strip()

        group_name = _normalize(
            group.name
        )

        # Handle natural-language plural form:
        # region -> regions
        group_prefixes = {
            group_name,
            f"{group_name}s",
            group_name.rstrip("s"),
        }

        for prefix in group_prefixes:
            if group_a.startswith(
                prefix + " "
            ):
                group_a = group_a[
                    len(prefix) + 1:
                ].strip()
                break

        if group_a and group_b:
            args["groupA"] = group_a
            args["groupB"] = group_b

    return AnalyticsPlan(
        operation="t_test",
        args=args,
        confidence=0.91,
        reason=(
            "The question asks whether two "
            "groups differ statistically."
        ),
    )


def _plan_visualization(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    if not _contains_any(
        question,
        [
            "chart",
            "plot",
            "graph",
            "visualize",
            "visualization",
            "visualise",
            "visualisation",
        ],
    ):
        return None

    numeric = _numeric_columns(columns)

    if not numeric:
        return None

    normalized_question = _normalize(
        question
    )

    x: str | None = None
    y: str | None = None

    # Explicit relationship:
    # "sales versus profit"
    # "sales vs profit"
    # "sales against profit"
    pair_match = re.search(
        r"\b([a-zA-Z_][a-zA-Z0-9 _-]*)\s+"
        r"(?:versus|vs\.?|against)\s+"
        r"([a-zA-Z_][a-zA-Z0-9 _-]*)\b",
        normalized_question,
    )

    if pair_match:
        left = pair_match.group(1).strip()
        right = pair_match.group(2).strip()

        left_column = _find_column(
            numeric,
            left,
            numeric=True,
        )
        right_column = _find_column(
            numeric,
            right,
            numeric=True,
        )

        if (
            left_column is not None
            and right_column is not None
            and left_column.name
            != right_column.name
        ):
            x = left_column.name
            y = right_column.name

    # If there is no explicit pair, try to find
    # the numeric measure mentioned in the question.
    if y is None:
        mentioned_numeric = _find_column(
            numeric,
            normalized_question,
            numeric=True,
        )

        if mentioned_numeric is not None:
            y = mentioned_numeric.name

    dates = _datetime_columns(columns)

    if x is None:
        if dates:
            x = dates[0].name
        else:
            categorical = _categorical_columns(
                columns
            )

            if categorical:
                x = categorical[0].name
            else:
                x = numeric[0].name

    if y is None:
        y_candidates = [
            column
            for column in numeric
            if column.name != x
        ]

        if y_candidates:
            y = y_candidates[0].name
        else:
            y = numeric[0].name

    numeric_names = {
        column.name
        for column in numeric
    }

    categorical_names = {
        column.name
        for column in _categorical_columns(
            columns
        )
    }

    if (
        x in numeric_names
        and y in numeric_names
    ):
        chart_type = "scatter"
    elif x in categorical_names:
        chart_type = "bar"
    else:
        chart_type = "line"

    return AnalyticsPlan(
        operation="visualization",
        args={
            "type": chart_type,
            "x": x,
            "y": y,
            "limit": 500,
        },
        confidence=0.94,
        reason=(
            "The question explicitly asks for "
            "a visual representation and the requested "
            "dimensions were mapped to dataset columns."
        ),
    )


def _plan_transform(
    question: str,
    columns: list[ColumnInfo],
) -> AnalyticsPlan | None:
    normalized_question = _normalize(
        question
    )

    numeric = _numeric_columns(columns)

    # Examples:
    # "fill missing sales values with 0"
    # "fill null profit with 10"
    # "replace missing revenue with 0"
    fill_match = re.search(
        r"(?:fill|replace)\s+"
        r"(?:missing|null|blank)\s+"
        r"([a-zA-Z_][a-zA-Z0-9 _-]*?)"
        r"(?:\s+values?)?\s+"
        r"with\s+"
        r"([-+]?\d+(?:\.\d+)?)"
        r"(?:\s*$|\s+)",
        normalized_question,
    )

    if fill_match:
        requested_column = (
            fill_match.group(1).strip()
        )
        value_text = fill_match.group(2)

        column = _find_column(
            columns,
            requested_column,
        )

        if column is not None:
            if "." in value_text:
                value: int | float = float(
                    value_text
                )
            else:
                value = int(value_text)

            return AnalyticsPlan(
                operation="transform",
                args={
                    "action": "fill_null",
                    "column": column.name,
                    "value": value,
                },
                confidence=0.97,
                reason=(
                    "The question explicitly asks to "
                    "replace missing values with a "
                    "specified value."
                ),
            )

    if _contains_any(
        normalized_question,
        [
            "drop missing",
            "drop null",
            "remove missing",
            "remove null",
        ],
    ):
        column = _find_column(
            columns,
            normalized_question,
        )

        if column is not None:
            return AnalyticsPlan(
                operation="transform",
                args={
                    "action": "drop_null",
                    "column": column.name,
                },
                confidence=0.95,
                reason=(
                    "The question asks to remove "
                    "rows with missing values."
                ),
            )

    if _contains_any(
        normalized_question,
        [
            "standardize",
            "standardise",
            "z normalize",
            "z-normalize",
        ],
    ) and numeric:
        column = _find_column(
            numeric,
            normalized_question,
            numeric=True,
        )

        if column is None:
            column = numeric[0]

        return AnalyticsPlan(
            operation="transform",
            args={
                "action": "standardize",
                "column": column.name,
            },
            confidence=0.92,
            reason=(
                "The question requests numeric "
                "standardization."
            ),
        )

    if _contains_any(
        normalized_question,
        [
            "normalize",
            "normalise",
            "scale to 0 1",
            "scale between 0 and 1",
        ],
    ) and numeric:
        column = _find_column(
            numeric,
            normalized_question,
            numeric=True,
        )

        if column is None:
            column = numeric[0]

        return AnalyticsPlan(
            operation="transform",
            args={
                "action": "normalize",
                "column": column.name,
            },
            confidence=0.92,
            reason=(
                "The question requests numeric "
                "normalization."
            ),
        )

    return None


def plan_analysis(
    question: str,
    columns: list[dict[str, Any]],
    max_plans: int = 4,
) -> PlannerResult:
    normalized_question = _normalize(
        question
    )

    if not normalized_question:
        return PlannerResult(
            question="",
            plans=[],
            warnings=[
                "A non-empty analytics question is required."
            ],
        )

    normalized_columns = normalize_columns(
        columns
    )

    plans: list[AnalyticsPlan] = []
    warnings: list[str] = []

    planners = [
        _plan_outliers,
        _plan_trend,
        _plan_distribution,
        _plan_t_test,
        _plan_correlation,
        _plan_percentiles,
        _plan_groupby,
        _plan_visualization,
        _plan_transform,
        _plan_describe,
    ]

    for planner in planners:
        if len(plans) >= max_plans:
            break

        try:
            plan = planner(
                normalized_question,
                normalized_columns,
            )
        except Exception as exc:
            warnings.append(
                f"Planner step failed: {exc}"
            )
            continue

        if plan is None:
            continue

        if plan.operation not in SUPPORTED_OPERATIONS:
            warnings.append(
                f"Planner produced unsupported operation "
                f"'{plan.operation}'."
            )
            continue

        plans.append(plan)

    numeric_count = len(
        _numeric_columns(
            normalized_columns
        )
    )

    if (
        numeric_count < 2
        and _contains_any(
            normalized_question,
            [
                "correlation",
                "correlated",
                "relationship",
                "association",
            ],
        )
    ):
        warnings.append(
            "Correlation analysis requires at least "
            "two numeric columns."
        )

    if (
        _contains_any(
            normalized_question,
            [
                "trend",
                "over time",
                "time series",
            ],
        )
        and not _datetime_columns(
            normalized_columns
        )
    ):
        warnings.append(
            "The question suggests time-series analysis, "
            "but no datetime column was detected."
        )

    if not plans:
        warnings.append(
            "No supported analytics operation could "
            "be confidently inferred from the question."
        )

    return PlannerResult(
        question=question,
        plans=plans,
        warnings=list(
            dict.fromkeys(warnings)
        ),
    )


def result_to_dict(
    result: PlannerResult,
) -> dict[str, Any]:
    return {
        "question": result.question,
        "plans": [
            asdict(plan)
            for plan in result.plans
        ],
        "warnings": result.warnings,
    }