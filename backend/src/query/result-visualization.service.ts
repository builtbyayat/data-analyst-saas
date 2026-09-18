import { Injectable } from '@nestjs/common';

export type VisualizationType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'donut'
  | 'table';

export type VisualizationLanguage =
  | 'english'
  | 'hindi'
  | 'hinglish';

export interface VisualizationColumn {
  name: string;
  kind: 'dimension' | 'measure' | 'date' | 'unknown';
  uniqueCount: number;
}

export interface ResultVisualization {
  enabled: boolean;
  type: VisualizationType | null;
  source: 'automatic' | 'user_requested' | null;
  language: VisualizationLanguage;
  xAxis: string | null;
  yAxis: string | null;
  series: string[];
  title: string | null;
  warning: string | null;
  reason: string | null;
}

@Injectable()
export class ResultVisualizationService {
  analyze(
    columns: string[],
    rows: unknown[][],
    userQuestion?: string | null,
  ): ResultVisualization {
    const language =
      this.detectLanguage(userQuestion ?? '');

    const requestedType =
      this.detectRequestedChartType(
        userQuestion ?? '',
      );

    const columnProfiles =
      this.profileColumns(
        columns,
        rows,
      );

    const automaticType =
      this.selectAutomaticType(
        columnProfiles,
        userQuestion ?? '',
      );

    if (requestedType) {
      const validation =
        this.validateRequestedType(
          requestedType,
          columnProfiles,
        );

      if (!validation.valid) {
        return {
          enabled: false,
          type: null,
          source: null,
          language,
          xAxis: null,
          yAxis: null,
          series: [],
          title: null,
          warning:
            this.buildWarning(
              requestedType,
              validation.reason,
              language,
            ),
          reason: validation.reason,
        };
      }

      const axes =
        this.buildAxes(
          requestedType,
          columnProfiles,
        );

      return {
        enabled: true,
        type: requestedType,
        source: 'user_requested',
        language,
        xAxis: axes.xAxis,
        yAxis: axes.yAxis,
        series: axes.series,
        title: this.buildTitle(
          requestedType,
          axes.xAxis,
          axes.yAxis,
          language,
        ),
        warning: null,
        reason:
          language === 'hindi'
            ? 'Data requested chart type ke liye suitable hai.'
            : language === 'hinglish'
              ? 'Data requested chart type ke liye suitable hai.'
              : 'The result data is suitable for the requested chart type.',
      };
    }

    if (!automaticType) {
      return {
        enabled: true,
        type: 'table',
        source: 'automatic',
        language,
        xAxis: null,
        yAxis: null,
        series: [],
        title:
          language === 'hindi'
            ? 'परिणाम'
            : language === 'hinglish'
              ? 'Results'
              : 'Results',
        warning: null,
        reason:
          language === 'hindi'
            ? 'Data kisi reliable chart structure ke liye suitable nahi tha, isliye table use ki gayi.'
            : language === 'hinglish'
              ? 'Data kisi reliable chart structure ke liye suitable nahi tha, isliye table use ki gayi.'
              : 'The data does not provide a reliable chart structure, so a table is used.',
      };
    }

    const axes =
      this.buildAxes(
        automaticType,
        columnProfiles,
      );

    return {
      enabled: true,
      type: automaticType,
      source: 'automatic',
      language,
      xAxis: axes.xAxis,
      yAxis: axes.yAxis,
      series: axes.series,
      title: this.buildTitle(
        automaticType,
        axes.xAxis,
        axes.yAxis,
        language,
      ),
      warning: null,
      reason:
        language === 'hindi'
          ? 'Chart type data structure ke basis par automatically select kiya gaya hai.'
          : language === 'hinglish'
            ? 'Chart type data structure ke basis par automatically select kiya gaya hai.'
            : 'The chart type was selected automatically from the result structure.',
    };
  }

  private detectLanguage(
    question: string,
  ): VisualizationLanguage {
    const normalized =
      question
        .toLowerCase()
        .trim();

    if (!normalized) {
      return 'english';
    }

    const devanagari =
      /[\u0900-\u097F]/.test(
        question,
      );

    if (devanagari) {
      return 'hindi';
    }

    const hindiWords = [
      'dikhao',
      'dikhaye',
      'batao',
      'bataye',
      'chahiye',
      'sales',
      'ke',
      'ka',
      'ki',
      'mein',
      'me',
      'par',
      'se',
      'aur',
      'mujhe',
      'data',
      'hisab',
      'anusar',
      'ke hisaab se',
    ];

    const matchedHindiWords =
      hindiWords.filter(
        (word) =>
          normalized.includes(
            word,
          ),
      ).length;

    if (
      matchedHindiWords >= 2
    ) {
      return 'hinglish';
    }

    return 'english';
  }

  private detectRequestedChartType(
    question: string,
  ): VisualizationType | null {
    const normalized =
      question
        .toLowerCase()
        .trim();

    if (!normalized) {
      return null;
    }

    if (
      /\b(donut|doughnut)\b/.test(
        normalized,
      ) ||
      /डोनट/.test(question)
    ) {
      return 'donut';
    }

    if (
      /\b(pie|pie chart)\b/.test(
        normalized,
      ) ||
      /पाई चार्ट|पाई/.test(question)
    ) {
      return 'pie';
    }

    if (
      /\b(line|line chart|line graph)\b/.test(
        normalized,
      ) ||
      /लाइन चार्ट|लाइन ग्राफ/.test(question)
    ) {
      return 'line';
    }

    if (
      /\b(bar|bar chart|bar graph)\b/.test(
        normalized,
      ) ||
      /बार चार्ट|बार ग्राफ/.test(question)
    ) {
      return 'bar';
    }

    if (
      /\b(table|tabular)\b/.test(
        normalized,
      ) ||
      /टेबल|तालिका/.test(question)
    ) {
      return 'table';
    }

    return null;
  }

  private profileColumns(
    columns: string[],
    rows: unknown[][],
  ): VisualizationColumn[] {
    return columns.map(
      (
        column,
        columnIndex,
      ) => {
        const values =
          rows
            .map(
              (row) =>
                row[columnIndex],
            )
            .filter(
              (value) =>
                value !== null &&
                value !== undefined &&
                String(
                  value,
                ).trim() !== '',
            );

        const uniqueCount =
          new Set(
            values.map(
              (value) =>
                String(value),
            ),
          ).size;

        if (
          values.length > 0 &&
          values.every(
            (value) =>
              this.isNumericValue(
                value,
              ),
          )
        ) {
          return {
            name: column,
            kind: 'measure',
            uniqueCount,
          };
        }

        if (
          values.length > 0 &&
          values.every(
            (value) =>
              this.isDateValue(
                value,
              ),
          )
        ) {
          return {
            name: column,
            kind: 'date',
            uniqueCount,
          };
        }

        if (
          values.length > 0
        ) {
          return {
            name: column,
            kind: 'dimension',
            uniqueCount,
          };
        }

        return {
          name: column,
          kind: 'unknown',
          uniqueCount,
        };
      },
    );
  }

  private selectAutomaticType(
    profiles: VisualizationColumn[],
    question: string,
  ): VisualizationType | null {
    const dimensions =
      profiles.filter(
        (column) =>
          column.kind ===
          'dimension',
      );

    const dates =
      profiles.filter(
        (column) =>
          column.kind === 'date',
      );

    const measures =
      profiles.filter(
        (column) =>
          column.kind === 'measure',
      );

    if (
      dates.length > 0 &&
      measures.length > 0
    ) {
      return 'line';
    }

    const normalized =
      question
        .toLowerCase();

    const shareIntent =
      /\b(share|shares|percentage|percent|proportion|distribution|breakdown)\b/.test(
        normalized,
      ) ||
      /प्रतिशत|हिस्सा|वितरण|अनुपात/.test(
        question,
      );

    if (
      shareIntent &&
      dimensions.length === 1 &&
      measures.length === 1 &&
      dimensions[0]!.uniqueCount <= 12
    ) {
      return 'pie';
    }

    if (
      dimensions.length > 0 &&
      measures.length > 0
    ) {
      return 'bar';
    }

    return null;
  }

  private validateRequestedType(
    type: VisualizationType,
    profiles: VisualizationColumn[],
  ): {
    valid: boolean;
    reason: string;
  } {
    if (type === 'table') {
      return {
        valid: true,
        reason: 'Table is valid for any result structure.',
      };
    }

    const dimensions =
      profiles.filter(
        (column) =>
          column.kind ===
          'dimension',
      );

    const dates =
      profiles.filter(
        (column) =>
          column.kind ===
          'date',
      );

    const measures =
      profiles.filter(
        (column) =>
          column.kind ===
          'measure',
      );

    if (
      type === 'bar'
    ) {
      if (
        dimensions.length === 0 &&
        dates.length === 0
      ) {
        return {
          valid: false,
          reason:
            'A bar chart needs a categorical or date field for the X-axis.',
        };
      }

      if (
        measures.length === 0
      ) {
        return {
          valid: false,
          reason:
            'A bar chart needs at least one numeric measure.',
        };
      }

      return {
        valid: true,
        reason: '',
      };
    }

    if (
      type === 'line'
    ) {
      if (
        dates.length === 0
      ) {
        return {
          valid: false,
          reason:
            'A line chart requires a date or time-based X-axis.',
        };
      }

      if (
        measures.length === 0
      ) {
        return {
          valid: false,
          reason:
            'A line chart needs at least one numeric measure.',
        };
      }

      return {
        valid: true,
        reason: '',
      };
    }

    if (
      type === 'pie' ||
      type === 'donut'
    ) {
      if (
        dimensions.length !== 1
      ) {
        return {
          valid: false,
          reason:
            'A pie or donut chart needs exactly one categorical dimension.',
        };
      }

      if (
        measures.length !== 1
      ) {
        return {
          valid: false,
          reason:
            'A pie or donut chart needs exactly one numeric measure.',
        };
      }

      if (
        dimensions[0]!.uniqueCount >
        12
      ) {
        return {
          valid: false,
          reason:
            'A pie or donut chart is not suitable when the category count is too high.',
        };
      }

      return {
        valid: true,
        reason: '',
      };
    }

    return {
      valid: false,
      reason:
        'The requested visualization type is not supported.',
    };
  }

  private buildAxes(
    type: VisualizationType,
    profiles: VisualizationColumn[],
  ): {
    xAxis: string | null;
    yAxis: string | null;
    series: string[];
  } {
    if (
      type === 'table'
    ) {
      return {
        xAxis: null,
        yAxis: null,
        series: [],
      };
    }

    const dimensions =
      profiles.filter(
        (column) =>
          column.kind ===
          'dimension',
      );

    const dates =
      profiles.filter(
        (column) =>
          column.kind ===
          'date',
      );

    const measures =
      profiles.filter(
        (column) =>
          column.kind ===
          'measure',
      );

    const xAxis =
      dates[0]?.name ??
      dimensions[0]?.name ??
      null;

    const yAxis =
      measures[0]?.name ??
      null;

    return {
      xAxis,
      yAxis,
      series: measures
        .slice(1)
        .map(
          (column) =>
            column.name,
        ),
    };
  }

  private buildTitle(
    type: VisualizationType,
    xAxis: string | null,
    yAxis: string | null,
    language: VisualizationLanguage,
  ): string {
    if (
      type === 'table'
    ) {
      return 'Results';
    }

    const chartName =
      type === 'donut'
        ? 'Donut'
        : type.charAt(0).toUpperCase() +
          type.slice(1);

    if (language === 'hindi') {
      return `${chartName} चार्ट`;
    }

    if (
      language === 'hinglish'
    ) {
      return `${chartName} Chart`;
    }

    return yAxis &&
      xAxis
      ? `${yAxis} by ${xAxis}`
      : `${chartName} Chart`;
  }

  private buildWarning(
    requestedType: VisualizationType,
    reason: string,
    language: VisualizationLanguage,
  ): string {
    const chartName =
      requestedType
        .charAt(0)
        .toUpperCase() +
      requestedType.slice(1);

    if (
      language === 'hindi'
    ) {
      return `⚠️ ${chartName} chart नहीं बनाया गया। ${this.translateReasonToHindi(reason)}`;
    }

    if (
      language === 'hinglish'
    ) {
      return `⚠️ ${chartName} chart generate nahi kiya gaya. ${reason}`;
    }

    return `⚠️ ${chartName} chart was not generated. ${reason}`;
  }

  private translateReasonToHindi(
    reason: string,
  ): string {
    if (
      reason.includes(
        'date or time-based X-axis',
      )
    ) {
      return 'Line chart ke liye date ya time-based X-axis required hai.';
    }

    if (
      reason.includes(
        'numeric measure',
      )
    ) {
      return 'Is chart ke liye kam se kam ek numeric measure required hai.';
    }

    if (
      reason.includes(
        'categorical dimension',
      )
    ) {
      return 'Is chart ke liye categorical dimension required hai.';
    }

    if (
      reason.includes(
        'category count is too high',
      )
    ) {
      return 'Categories ki sankhya bahut zyada hai, isliye ye chart suitable nahi hai.';
    }

    return reason;
  }

  private isNumericValue(
    value: unknown,
  ): boolean {
    if (
      typeof value === 'number'
    ) {
      return Number.isFinite(
        value,
      );
    }

    if (
      typeof value === 'bigint'
    ) {
      return true;
    }

    if (
      typeof value === 'string'
    ) {
      const normalized =
        value.trim();

      if (!normalized) {
        return false;
      }

      return Number.isFinite(
        Number(normalized),
      );
    }

    return false;
  }

  private isDateValue(
    value: unknown,
  ): boolean {
    if (
      value instanceof Date
    ) {
      return !Number.isNaN(
        value.getTime(),
      );
    }

    if (
      typeof value !==
      'string'
    ) {
      return false;
    }

    const normalized =
      value.trim();

    if (!normalized) {
      return false;
    }

    if (
      /^\d{4}-\d{2}-\d{2}/.test(
        normalized,
      )
    ) {
      return !Number.isNaN(
        Date.parse(
          normalized,
        ),
      );
    }

    return false;
  }
}