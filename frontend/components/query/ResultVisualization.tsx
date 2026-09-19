'use client';

import React, {
  useMemo,
  useState,
} from 'react';

type ChartType =
  | 'bar'
  | 'line';

interface ResultVisualizationProps {
  columns: string[];
  rows: unknown[][];
}

interface NormalizedPoint {
  label: string;
  value: number;
}

function toNumber(
  value: unknown,
): number | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === 'string' &&
    value.trim() !== ''
  ) {
    const parsed = Number(
      value
        .replace(/,/g, '')
        .trim(),
    );

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function formatValue(
  value: number,
): string {
  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function shortenLabel(
  value: string,
  maxLength = 18,
): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(
    0,
    maxLength - 1,
  )}…`;
}

export default function ResultVisualization({
  columns,
  rows,
}: ResultVisualizationProps) {
  const numericColumnIndexes =
    useMemo(
      () => {
        return columns
          .map(
            (_, columnIndex) => {
              const values = rows
                .slice(0, 100)
                .map(
                  (row) =>
                    row[columnIndex],
                )
                .filter(
                  (value) =>
                    value !== null &&
                    value !== undefined &&
                    String(value).trim() !== '',
                );

              if (
                values.length === 0
              ) {
                return null;
              }

              const numericCount =
                values.filter(
                  (value) =>
                    toNumber(value) !== null,
                ).length;

              return (
                numericCount /
                  values.length >=
                0.6
              )
                ? columnIndex
                : null;
            },
          )
          .filter(
            (
              value,
            ): value is number =>
              value !== null,
          );
      },
      [columns, rows],
    );

  const categoricalColumnIndexes =
    useMemo(
      () => {
        return columns
          .map(
            (_, columnIndex) => {
              const values = rows
                .slice(0, 100)
                .map(
                  (row) =>
                    row[columnIndex],
                )
                .filter(
                  (value) =>
                    value !== null &&
                    value !== undefined &&
                    String(value).trim() !== '',
                );

              if (
                values.length === 0
              ) {
                return null;
              }

              const numericCount =
                values.filter(
                  (value) =>
                    toNumber(value) !== null,
                ).length;

              return (
                numericCount /
                  values.length <
                0.6
              )
                ? columnIndex
                : null;
            },
          )
          .filter(
            (
              value,
            ): value is number =>
              value !== null,
          );
      },
      [columns, rows],
    );

  const defaultXIndex =
    categoricalColumnIndexes[0] ??
    (columns.length > 0 ? 0 : -1);

  const defaultYIndex =
    numericColumnIndexes[0] ??
    (columns.length > 1 ? 1 : -1);

  const [
    chartType,
    setChartType,
  ] = useState<ChartType>('bar');

  const [
    xIndex,
    setXIndex,
  ] = useState(defaultXIndex);

  const [
    yIndex,
    setYIndex,
  ] = useState(defaultYIndex);

  const points =
    useMemo<NormalizedPoint[]>(
      () => {
        if (
          xIndex < 0 ||
          yIndex < 0
        ) {
          return [];
        }

        return rows
          .map(
            (row) => {
              const rawLabel =
                row[xIndex];

              const rawValue =
                row[yIndex];

              const value =
                toNumber(rawValue);

              if (
                value === null ||
                rawLabel === null ||
                rawLabel === undefined
              ) {
                return null;
              }

              return {
                label:
                  String(rawLabel),
                value,
              };
            },
          )
          .filter(
            (
              point,
            ): point is NormalizedPoint =>
              point !== null,
          );
      },
      [
        rows,
        xIndex,
        yIndex,
      ],
    );

  const minValue = useMemo(
    () =>
      points.length > 0
        ? Math.min(
            ...points.map(
              (point) =>
                point.value,
            ),
          )
        : 0,
    [points],
  );

  const maxValue = useMemo(
    () =>
      points.length > 0
        ? Math.max(
            ...points.map(
              (point) =>
                point.value,
            ),
          )
        : 0,
    [points],
  );

  /*
   * Keep zero visible for positive datasets.
   *
   * Example:
   * min = 1
   * max = 3
   *
   * becomes:
   * 0
   * 1
   * 2
   * 3
   *
   * This prevents Quantity = 1 from becoming
   * a zero-height bar.
   */
  const chartMinValue =
    minValue > 0
      ? 0
      : Math.floor(minValue);

  const chartMaxValue =
    maxValue < 0
      ? 0
      : Math.ceil(maxValue);

  const rawRange =
    chartMaxValue -
      chartMinValue;

  const safeRange =
    rawRange > 0
      ? rawRange
      : 1;

  /*
   * Dynamic integer tick step.
   *
   * For small values:
   * 0, 1, 2, 3
   *
   * For larger values:
   * 0, 10, 20, 30...
   *
   * This keeps the axis readable without
   * producing decimals like 0.75 or 2.25.
   */
  const tickStep =
    safeRange <= 10
      ? 1
      : Math.ceil(
          safeRange / 10,
        );

  const tickValues =
    useMemo(() => {
      const values: number[] = [];

      let current =
        Math.ceil(
          chartMinValue /
            tickStep,
        ) * tickStep;

      const end =
        Math.floor(
          chartMaxValue /
            tickStep,
        ) * tickStep;

      while (
        current <= end
      ) {
        values.push(current);
        current += tickStep;
      }

      if (
        values.length === 0
      ) {
        values.push(
          chartMinValue,
          chartMaxValue,
        );
      }

      return values;
    }, [
      chartMinValue,
      chartMaxValue,
      tickStep,
    ]);

  /*
   * The chart grows with the number of points.
   *
   * 10 points  -> normal width
   * 100 points -> very wide chart
   *
   * The parent container has horizontal
   * scrolling, so every point remains available.
   */
  const chartWidth = Math.max(
    960,
    120 +
      points.length * 72,
  );

  const plotLeft = 80;
  const plotRight =
    chartWidth - 30;

  const plotTop = 40;
  const plotBottom = 350;

  const plotWidth =
    plotRight - plotLeft;

  const plotHeight =
    plotBottom - plotTop;

  const zeroY =
    plotBottom -
    ((0 - chartMinValue) /
      safeRange) *
      plotHeight;

  if (
    columns.length === 0 ||
    rows.length === 0
  ) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-sm font-semibold text-white">
          Visualization
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-neutral-500">
          No result data available for visualization.
        </div>
      </section>
    );
  }

  if (
    numericColumnIndexes.length === 0 ||
    columns.length < 2
  ) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-sm font-semibold text-white">
          Visualization
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-neutral-500">
          A chart needs at least one
          categorical field and one
          numeric field.
        </div>
      </section>
    );
  }

  if (points.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-sm font-semibold text-white">
          Visualization
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-neutral-500">
          No numeric values are available
          for the selected Y-axis field.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">
            Visualization
          </div>

          <div className="mt-1 text-xs text-neutral-500">
            Explore the returned data with
            a generated chart.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={chartType}
            onChange={(event) =>
              setChartType(
                event.target.value as ChartType,
              )
            }
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-200 outline-none"
          >
            <option value="bar">
              Bar chart
            </option>

            <option value="line">
              Line chart
            </option>
          </select>

          <select
            value={xIndex}
            onChange={(event) =>
              setXIndex(
                Number(
                  event.target.value,
                ),
              )
            }
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-200 outline-none"
          >
            {columns.map(
              (
                column,
                index,
              ) => (
                <option
                  key={`${column}-${index}`}
                  value={index}
                >
                  X: {column}
                </option>
              ),
            )}
          </select>

          <select
            value={yIndex}
            onChange={(event) =>
              setYIndex(
                Number(
                  event.target.value,
                ),
              )
            }
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-200 outline-none"
          >
            {numericColumnIndexes.map(
              (index) => (
                <option
                  key={index}
                  value={index}
                >
                  Y: {columns[index]}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      <div className="mt-6">
        <div className="overflow-x-auto pb-3">
          <div
            style={{
              width: `${chartWidth}px`,
              minWidth: `${chartWidth}px`,
            }}
          >
            <svg
              viewBox={`0 0 ${chartWidth} 420`}
              width={chartWidth}
              height="420"
              role="img"
              aria-label={`${chartType} chart`}
              className="block"
            >
              <line
                x1={plotLeft}
                y1={plotTop}
                x2={plotLeft}
                y2={plotBottom}
                stroke="currentColor"
                className="text-white/20"
              />

              <line
                x1={plotLeft}
                y1={zeroY}
                x2={plotRight}
                y2={zeroY}
                stroke="currentColor"
                className="text-white/20"
              />

              {tickValues.map(
                (value) => {
                  const y =
                    plotBottom -
                    ((value -
                      chartMinValue) /
                      safeRange) *
                      plotHeight;

                  return (
                    <React.Fragment
                      key={`tick-${value}`}
                    >
                      <line
                        x1={plotLeft}
                        y1={y}
                        x2={plotRight}
                        y2={y}
                        stroke="currentColor"
                        className="text-white/[0.05]"
                      />

                      <text
                        x={
                          plotLeft - 12
                        }
                        y={y + 4}
                        textAnchor="end"
                        className="fill-neutral-500 text-[11px]"
                      >
                        {formatValue(
                          value,
                        )}
                      </text>
                    </React.Fragment>
                  );
                },
              )}

              {chartType ===
                'bar' &&
                points.map(
                  (
                    point,
                    index,
                  ) => {
                    const slotWidth =
                      plotWidth /
                      points.length;

                    const barWidth =
                      Math.max(
                        12,
                        Math.min(
                          56,
                          slotWidth *
                            0.62,
                        ),
                      );

                    const valueHeight =
                      Math.abs(
                        point.value,
                      ) /
                      safeRange *
                      plotHeight;

                    const x =
                      plotLeft +
                      index *
                        slotWidth +
                      (slotWidth -
                        barWidth) /
                        2;

                    const y =
                      point.value >=
                      0
                        ? zeroY -
                          valueHeight
                        : zeroY;

                    const height =
                      valueHeight;

                    return (
                      <React.Fragment
                        key={`${point.label}-${index}`}
                      >
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={
                            Math.max(
                              height,
                              1,
                            )
                          }
                          rx="7"
                          className="fill-white/80"
                        />

                        <text
                          x={
                            x +
                            barWidth /
                              2
                          }
                          y="372"
                          textAnchor="middle"
                          className="fill-neutral-500 text-[10px]"
                        >
                          {shortenLabel(
                            point.label,
                            12,
                          )}
                        </text>
                      </React.Fragment>
                    );
                  },
                )}

              {chartType ===
                'line' && (
                <>
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                    points={points
                      .map(
                        (
                          point,
                          index,
                        ) => {
                          const slotWidth =
                            plotWidth /
                            Math.max(
                              points.length -
                                1,
                              1,
                            );

                          const x =
                            points.length ===
                            1
                              ? plotLeft +
                                plotWidth /
                                  2
                              : plotLeft +
                                index *
                                  slotWidth;

                          const y =
                            plotBottom -
                            ((point.value -
                              chartMinValue) /
                              safeRange) *
                              plotHeight;

                          return `${x},${y}`;
                        },
                      )
                      .join(' ')}
                  />

                  {points.map(
                    (
                      point,
                      index,
                    ) => {
                      const slotWidth =
                        plotWidth /
                        Math.max(
                          points.length -
                            1,
                          1,
                        );

                      const x =
                        points.length ===
                        1
                          ? plotLeft +
                            plotWidth /
                              2
                          : plotLeft +
                            index *
                              slotWidth;

                      const y =
                        plotBottom -
                        ((point.value -
                          chartMinValue) /
                          safeRange) *
                          plotHeight;

                      return (
                        <React.Fragment
                          key={`${point.label}-${index}`}
                        >
                          <circle
                            cx={x}
                            cy={y}
                            r="5"
                            className="fill-white"
                          />

                          <text
                            x={x}
                            y="372"
                            textAnchor="middle"
                            className="fill-neutral-500 text-[10px]"
                          >
                            {shortenLabel(
                              point.label,
                              12,
                            )}
                          </text>
                        </React.Fragment>
                      );
                    },
                  )}
                </>
              )}
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500">
        <span>
          X-axis:{' '}
          <span className="text-neutral-300">
            {columns[xIndex]}
          </span>
        </span>

        <span>
          Y-axis:{' '}
          <span className="text-neutral-300">
            {columns[yIndex]}
          </span>
        </span>

        <span>
          Points:{' '}
          <span className="text-neutral-300">
            {points.length}
          </span>
        </span>
      </div>
    </section>
  );
}