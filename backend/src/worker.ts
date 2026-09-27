import 'dotenv/config';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';

import { DataSource } from 'typeorm';

import {
  Job,
  Queue,
  UnrecoverableError,
  Worker,
} from 'bullmq';

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  DuckDBConnection,
  DuckDBInstance,
} from '@duckdb/node-api';

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

import { AppModule } from './app.module.js';
import {
  AnalysisJobData,
  QueryService,
} from './query/query.service.js';
import { Dataset } from './datasets/dataset.entity.js';
import { DatasetColumn } from './datasets/dataset-column.entity.js';

import { StructuredLoggerService } from './observability/structured-logger.service.js';

const logger = new StructuredLoggerService();

/* -------------------------------------------------------------------------- */
/*                              Worker config                                 */
/* -------------------------------------------------------------------------- */

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? '6379'),
};

const s3Client = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',

  endpoint: process.env.S3_ENDPOINT,

  forcePathStyle:
    (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',

  credentials: {
    accessKeyId:
      process.env.S3_ACCESS_KEY ??
      'minioadmin',

    secretAccessKey:
      process.env.S3_SECRET_KEY ??
      'minioadminpassword',
  },
});

const bucket =
  process.env.S3_BUCKET ?? 'datasets';

const analysisConcurrency = Math.max(
  1,
  Number(
    process.env.ANALYSIS_WORKER_CONCURRENCY ?? '2',
  ),
);

const datasetIngestionConcurrency = Math.max(
  1,
  Number(
    process.env.DATASET_INGESTION_WORKER_CONCURRENCY ??
      '2',
  ),
);

const analysisJobTimeoutMs = Math.max(
  1_000,
  Number(
    process.env.ANALYSIS_JOB_TIMEOUT_MS ??
      '900000',
  ),
);

const datasetIngestionJobTimeoutMs = Math.max(
  1_000,
  Number(
    process.env.DATASET_INGESTION_JOB_TIMEOUT_MS ??
      '900000',
  ),
);

const completedJobCleanupGraceMs = Math.max(
  60_000,
  Number(
    process.env.BULLMQ_COMPLETED_JOB_CLEANUP_GRACE_MS ??
      '86400000',
  ),
);

const failedJobCleanupGraceMs = Math.max(
  60_000,
  Number(
    process.env.BULLMQ_FAILED_JOB_CLEANUP_GRACE_MS ??
      '604800000',
  ),
);

const cleanupIntervalMs = Math.max(
  60_000,
  Number(
    process.env.BULLMQ_CLEANUP_INTERVAL_MS ??
      '3600000',
  ),
);

const maxStalledCount = Math.max(
  1,
  Number(
    process.env.BULLMQ_MAX_STALLED_COUNT ?? '2',
  ),
);

const stalledIntervalMs = Math.max(
  1_000,
  Number(
    process.env.BULLMQ_STALLED_INTERVAL_MS ??
      '30000',
  ),
);

const lockDurationMs = Math.max(
  30_000,
  Number(
    process.env.BULLMQ_LOCK_DURATION_MS ??
      '60000',
  ),
);

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

type DatasetRecord = Record<string, string>;

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutHandle:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeoutPromise =
    new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);
    });

  return Promise.race([
    promise,
    timeoutPromise,
  ]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });
}

async function updateProgress(
  job: Job,
  progress: number | Record<string, unknown>,
): Promise<void> {
  if (
    typeof progress === 'number'
  ) {
    const normalizedProgress = Math.min(
      100,
      Math.max(
        0,
        Math.round(progress),
      ),
    );

    await job.updateProgress(
      normalizedProgress,
    );

    return;
  }

  await job.updateProgress(
    progress,
  );
}

async function getObjectBuffer(
  objectKey: string,
): Promise<Buffer> {
  const response =
    await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }),
    );

  if (!response.Body) {
    throw new Error(
      'Object storage returned an empty body',
    );
  }

  const bytes =
    await response.Body.transformToByteArray();

  return Buffer.from(bytes);
}

async function uploadObject(
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

function isMeaningfulValue(
  value: unknown,
): boolean {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ''
  );
}

function normalizeHeaders(
  headers: unknown[],
): string[] {
  const usedNames =
    new Map<string, number>();

  return headers.map(
    (header, index) => {
      const rawName =
        String(
          header ?? '',
        ).trim();

      const baseName =
        rawName ||
        `column_${index + 1}`;

      const previousCount =
        usedNames.get(
          baseName,
        ) ?? 0;

      const nextCount =
        previousCount + 1;

      usedNames.set(
        baseName,
        nextCount,
      );

      if (nextCount === 1) {
        return baseName;
      }

      return `${baseName}_${nextCount}`;
    },
  );
}

function parseCsv(
  buffer: Buffer,
): DatasetRecord[] {
  return parse(
    buffer,
    {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    },
  ) as DatasetRecord[];
}

function parseExcel(
  buffer: Buffer,
): DatasetRecord[] {
  const workbook =
    XLSX.read(
      buffer,
      {
        type: 'buffer',
        cellDates: true,
      },
    );

  const firstSheetName =
    workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error(
      'Excel file contains no worksheets',
    );
  }

  const worksheet =
    workbook.Sheets[
      firstSheetName
    ];

  if (!worksheet) {
    throw new Error(
      'Excel worksheet could not be loaded',
    );
  }

  const matrix =
    XLSX.utils.sheet_to_json(
      worksheet,
      {
        header: 1,
        defval: '',
        raw: false,
      },
    ) as unknown[][];

  const nonEmptyRows =
    matrix.filter(
      (row) =>
        row.some(
          isMeaningfulValue,
        ),
    );

  if (
    nonEmptyRows.length === 0
  ) {
    return [];
  }

  const headerRow =
    nonEmptyRows[0] ?? [];

  const dataRows =
    nonEmptyRows.slice(1);

  const maxColumnCount =
    Math.max(
      headerRow.length,
      ...dataRows.map(
        (row) =>
          row.length,
      ),
    );

  const activeColumnIndexes: number[] = [];

  for (
    let index = 0;
    index < maxColumnCount;
    index += 1
  ) {
    const headerValue =
      headerRow[index];

    const hasHeader =
      isMeaningfulValue(
        headerValue,
      );

    const hasData =
      dataRows.some(
        (row) =>
          isMeaningfulValue(
            row[index],
          ),
      );

    if (
      hasHeader ||
      hasData
    ) {
      activeColumnIndexes.push(
        index,
      );
    }
  }

  if (
    activeColumnIndexes.length === 0
  ) {
    return [];
  }

  const rawHeaders =
    activeColumnIndexes.map(
      (index) =>
        headerRow[index] ?? '',
    );

  const headers =
    normalizeHeaders(
      rawHeaders,
    );

  return dataRows
    .filter(
      (row) =>
        activeColumnIndexes.some(
          (index) =>
            isMeaningfulValue(
              row[index],
            ),
        ),
    )
    .map(
      (row) => {
        const record:
          DatasetRecord = {};

        activeColumnIndexes.forEach(
          (
            columnIndex,
            index,
          ) => {
            record[
              headers[index]!
            ] = String(
              row[columnIndex] ??
                '',
            ).trim();
          },
        );

        return record;
      },
    );
}

function parseDataset(
  buffer: Buffer,
  fileType: string,
  originalFilename: string,
): DatasetRecord[] {
  const normalizedType =
    fileType.toLowerCase();

  const normalizedFilename =
    originalFilename.toLowerCase();

  const isCsv =
    normalizedType.includes(
      'csv',
    ) ||
    normalizedFilename.endsWith(
      '.csv',
    );

  if (isCsv) {
    return parseCsv(
      buffer,
    );
  }

  const isExcel =
    normalizedType.includes(
      'spreadsheet',
    ) ||
    normalizedType.includes(
      'ms-excel',
    ) ||
    normalizedFilename.endsWith(
      '.xlsx',
    ) ||
    normalizedFilename.endsWith(
      '.xls',
    );

  if (isExcel) {
    return parseExcel(
      buffer,
    );
  }

  throw new Error(
    `Unsupported dataset file type: ${fileType}`,
  );
}

function inferDataType(
  values: string[],
): string {
  const nonEmptyValues =
    values.filter(
      (value) =>
        value.trim() !== '',
    );

  if (
    nonEmptyValues.length === 0
  ) {
    return 'string';
  }

  const isBoolean =
    nonEmptyValues.every(
      (value) => {
        const normalized =
          value
            .trim()
            .toLowerCase();

        return (
          normalized === 'true' ||
          normalized === 'false'
        );
      },
    );

  if (isBoolean) {
    return 'boolean';
  }

  const isInteger =
    nonEmptyValues.every(
      (value) =>
        /^-?\d+$/.test(
          value.trim(),
        ),
    );

  if (isInteger) {
    return 'integer';
  }

  const isNumber =
    nonEmptyValues.every(
      (value) =>
        value.trim() !== '' &&
        Number.isFinite(
          Number(
            value.trim(),
          ),
        ),
    );

  if (isNumber) {
    return 'number';
  }

  const isDate =
    nonEmptyValues.every(
      (value) =>
        !Number.isNaN(
          Date.parse(
            value.trim(),
          ),
        ),
    );

  if (isDate) {
    return 'date';
  }

  return 'string';
}

function escapeCsvValue(
  value: unknown,
): string {
  const text =
    String(value ?? '');

  if (
    /[",\r\n]/.test(
      text,
    )
  ) {
    return `"${text.replace(
      /"/g,
      '""',
    )}"`;
  }

  return text;
}

function recordsToCsv(
  records: DatasetRecord[],
  columnNames: string[],
): string {
  const header =
    columnNames
      .map(
        escapeCsvValue,
      )
      .join(',');

  const rows =
    records.map(
      (record) =>
        columnNames
          .map(
            (columnName) =>
              escapeCsvValue(
                record[
                  columnName
                ] ?? '',
              ),
          )
          .join(','),
    );

  return [
    header,
    ...rows,
  ].join('\r\n') + '\r\n';
}

function escapeSqlString(
  value: string,
): string {
  return value.replace(
    /'/g,
    "''",
  );
}

function toDuckDbPath(
  filePath: string,
): string {
  return filePath.replace(
    /\\/g,
    '/',
  );
}

async function generateParquet(
  records: DatasetRecord[],
  columnNames: string[],
): Promise<Buffer> {
  if (
    columnNames.length === 0
  ) {
    throw new Error(
      'Dataset contains no columns',
    );
  }

  if (
    records.length === 0
  ) {
    throw new Error(
      'Dataset contains no data rows',
    );
  }

  const tempDirectory =
    await mkdtemp(
      join(
        tmpdir(),
        'dataset-parquet-',
      ),
    );

  const csvPath =
    join(
      tempDirectory,
      'dataset.csv',
    );

  const parquetPath =
    join(
      tempDirectory,
      'dataset.parquet',
    );

  let instance:
    DuckDBInstance | null = null;

  let connection:
    DuckDBConnection | null = null;

  try {
    const csvContent =
      recordsToCsv(
        records,
        columnNames,
      );

    await writeFile(
      csvPath,
      csvContent,
      'utf8',
    );

    instance =
      await DuckDBInstance.create(
        ':memory:',
      );

    connection =
      await instance.connect();

    const duckDbCsvPath =
      escapeSqlString(
        toDuckDbPath(
          csvPath,
        ),
      );

    const duckDbParquetPath =
      escapeSqlString(
        toDuckDbPath(
          parquetPath,
        ),
      );

    await connection.run(`
      COPY (
        SELECT *
        FROM read_csv_auto(
          '${duckDbCsvPath}',
          header = true,
          sample_size = -1
        )
      )
      TO '${duckDbParquetPath}'
      (
        FORMAT PARQUET
      );
    `);

    return await readFile(
      parquetPath,
    );
  } finally {
    if (connection) {
      connection.disconnectSync();
    }

    instance = null;

    await rm(
      tempDirectory,
      {
        recursive: true,
        force: true,
      },
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                           Dataset ingestion                                */
/* -------------------------------------------------------------------------- */

async function processDataset(
  dataSource: DataSource,
  datasetId: string,
  workspaceId: string,
  job?: Job,
) {
  const datasetRepository =
    dataSource.getRepository(
      Dataset,
    );

  const columnRepository =
    dataSource.getRepository(
      DatasetColumn,
    );

  const dataset =
    await datasetRepository.findOne({
      where: {
        id: datasetId,
        workspaceId,
      },
    });

  if (!dataset) {
    throw new Error(
      'Dataset was not found for this workspace',
    );
  }

  try {
    if (job) {
      await updateProgress(
        job,
        5,
      );
    }

    await datasetRepository.update(
      {
        id: dataset.id,
        workspaceId:
          dataset.workspaceId,
      },
      {
        status: 'processing',
      },
    );

    logger.log(
      `[dataset_ingestion] Reading object: ${dataset.objectKey}`,
    );

    const buffer =
      await getObjectBuffer(
        dataset.objectKey,
      );

    logger.log(
      `[dataset_ingestion] Downloaded ${buffer.length} bytes`,
    );

    if (job) {
      await updateProgress(
        job,
        20,
      );
    }

    const records =
      parseDataset(
        buffer,
        dataset.fileType,
        dataset.originalFilename,
      );

    const columnNames =
      records.length > 0
        ? Object.keys(
            records[0]!,
          )
        : [];

    logger.log(
      `[dataset_ingestion] Rows: ${records.length}`,
    );

    logger.log(
      `[dataset_ingestion] Columns: ${columnNames.length}`,
    );

    logger.log(
      '[dataset_ingestion] Column names:',
      columnNames,
    );

    if (job) {
      await updateProgress(
        job,
        40,
      );
    }

    await columnRepository.delete({
      datasetId:
        dataset.id,
    });

    const columns =
      columnNames.map(
        (
          columnName,
          index,
        ) => {
          const values =
            records.map(
              (record) =>
                String(
                  record[
                    columnName
                  ] ?? '',
                ),
            );

          const nullCount =
            values.filter(
              (value) =>
                value.trim() === '',
            ).length;

          const distinctCount =
            new Set(
              values.filter(
                (value) =>
                  value.trim() !== '',
              ),
            ).size;

          const dataType =
            inferDataType(
              values,
            );

          return columnRepository.create({
            datasetId:
              dataset.id,
            name: columnName,
            dataType,
            ordinalPosition:
              index,
            nullable:
              nullCount > 0,
            nullCount,
            distinctCount,
          });
        },
      );

    if (
      columns.length > 0
    ) {
      await columnRepository.save(
        columns,
      );
    }

    if (job) {
      await updateProgress(
        job,
        55,
      );
    }

    logger.log(
      '[dataset_ingestion] Generating Parquet file',
    );

    const parquetBuffer =
      await generateParquet(
        records,
        columnNames,
      );

    logger.log(
      `[dataset_ingestion] Generated Parquet: ${parquetBuffer.length} bytes`,
    );

    if (job) {
      await updateProgress(
        job,
        75,
      );
    }

    const queryObjectKey =
      `workspaces/${workspaceId}/datasets/${dataset.id}/query.parquet`;

    await uploadObject(
      queryObjectKey,
      parquetBuffer,
      'application/vnd.apache.parquet',
    );

    logger.log(
      `[dataset_ingestion] Uploaded query object: ${queryObjectKey}`,
    );

    if (job) {
      await updateProgress(
        job,
        90,
      );
    }

    await datasetRepository.update(
      {
        id: dataset.id,
        workspaceId:
          dataset.workspaceId,
      },
      {
        rowCount:
          records.length,

        columnCount:
          columnNames.length,

        queryObjectKey,

        status: 'ready',
      },
    );

    if (job) {
      await updateProgress(
        job,
        100,
      );
    }

    logger.log(
      `[dataset_ingestion] Dataset ${dataset.id} is ready`,
    );

    return {
      success: true,

      datasetId,

      workspaceId,

      rowCount:
        records.length,

      columnCount:
        columnNames.length,

      columnNames,

      queryObjectKey,
    };
  } catch (error) {
    await datasetRepository.update(
      {
        id: dataset.id,
        workspaceId:
          dataset.workspaceId,
      },
      {
        status: 'failed',
      },
    );

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*                                Queues                                      */
/* -------------------------------------------------------------------------- */

const analysisQueue =
  new Queue(
    'analysis',
    {
      connection:
        redisConnection,
    },
  );

const datasetIngestionQueue =
  new Queue(
    'dataset_ingestion',
    {
      connection:
        redisConnection,
    },
  );

/* -------------------------------------------------------------------------- */
/*                         Runtime state                                      */
/* -------------------------------------------------------------------------- */

let applicationContext:
  INestApplicationContext | null =
  null;

let analysisWorker:
  Worker<AnalysisJobData> | null =
  null;

let datasetIngestionWorker:
  Worker | null =
  null;

let cleanupTimer:
  ReturnType<typeof setInterval> | null =
  null;

let shuttingDown = false;

/* -------------------------------------------------------------------------- */
/*                          Error classification                               */
/* -------------------------------------------------------------------------- */

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message.slice(
      0,
      4000,
    );
  }

  return String(
    error,
  ).slice(
    0,
    4000,
  );
}

function isClientError(
  error: unknown,
): boolean {
  if (
    typeof error !== 'object' ||
    error === null
  ) {
    return false;
  }

  const candidate =
    error as {
      getStatus?: () => number;
      status?: number;
      statusCode?: number;
    };

  if (
    typeof candidate.getStatus ===
    'function'
  ) {
    const status =
      candidate.getStatus();

    return (
      status >= 400 &&
      status < 500
    );
  }

  const status =
    candidate.status ??
    candidate.statusCode;

  return (
    typeof status ===
      'number' &&
    status >= 400 &&
    status < 500
  );
}

function toWorkerError(
  error: unknown,
): Error {
  if (
    error instanceof UnrecoverableError
  ) {
    return error;
  }

  if (
    isClientError(error)
  ) {
    return new UnrecoverableError(
      getErrorMessage(
        error,
      ),
    );
  }

  if (
    error instanceof Error
  ) {
    return error;
  }

  return new Error(
    getErrorMessage(
      error,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/*                            Job cleanup                                     */
/* -------------------------------------------------------------------------- */

async function cleanupQueue(
  queue: Queue,
  queueName: string,
): Promise<void> {
  try {
    const completedRemoved =
      await queue.clean(
        completedJobCleanupGraceMs,
        1000,
        'completed',
      );

    const failedRemoved =
      await queue.clean(
        failedJobCleanupGraceMs,
        1000,
        'failed',
      );

    if (
      completedRemoved.length > 0 ||
      failedRemoved.length > 0
    ) {
      logger.log(
        `[${queueName}] Cleanup removed ${completedRemoved.length} completed and ${failedRemoved.length} failed jobs`,
      );
    }
  } catch (error) {
    logger.error(
      `[${queueName}] Job cleanup failed:`,
      error,
    );
  }
}

async function runCleanup(): Promise<void> {
  await cleanupQueue(
    analysisQueue,
    'analysis',
  );

  await cleanupQueue(
    datasetIngestionQueue,
    'dataset_ingestion',
  );
}

/* -------------------------------------------------------------------------- */
/*                         Worker event handlers                               */
/* -------------------------------------------------------------------------- */

function registerAnalysisWorkerEvents(
  worker: Worker<AnalysisJobData>,
): void {
  worker.on(
    'active',
    (job) => {
      logger.log(
        `[analysis] Job ${job.id} is active`,
      );
    },
  );

  worker.on(
    'completed',
    (job) => {
      logger.log(
        `[analysis] Job ${job.id} completed`,
      );
    },
  );

  worker.on(
    'failed',
    (job, error) => {
      logger.error(
        `[analysis] Job ${job?.id} failed:`,
        error,
      );
    },
  );

  worker.on(
    'stalled',
    (jobId) => {
      logger.warn(
        `[analysis] Job ${jobId} stalled and will be retried by BullMQ`,
      );
    },
  );

  worker.on(
    'error',
    (error) => {
      logger.error(
        '[analysis] Worker error:',
        error,
      );
    },
  );
}

function registerDatasetIngestionWorkerEvents(
  worker: Worker,
): void {
  worker.on(
    'active',
    (job) => {
      logger.log(
        `[dataset_ingestion] Job ${job.id} is active`,
      );
    },
  );

  worker.on(
    'completed',
    (job) => {
      logger.log(
        `[dataset_ingestion] Job ${job.id} completed`,
      );
    },
  );

  worker.on(
    'failed',
    (job, error) => {
      logger.error(
        `[dataset_ingestion] Job ${job?.id} failed:`,
        error,
      );
    },
  );

  worker.on(
    'stalled',
    (jobId) => {
      logger.warn(
        `[dataset_ingestion] Job ${jobId} stalled and will be retried by BullMQ`,
      );
    },
  );

  worker.on(
    'error',
    (error) => {
      logger.error(
        '[dataset_ingestion] Worker error:',
        error,
      );
    },
  );
}

/* -------------------------------------------------------------------------- */
/*                          Worker startup                                    */
/* -------------------------------------------------------------------------- */

async function bootstrapWorkers(): Promise<void> {
  applicationContext =
    await NestFactory.createApplicationContext(
      AppModule,
    );

  const dataSource =
    applicationContext.get(
      DataSource,
    );

  const queryService =
    applicationContext.get(
      QueryService,
    );

  /*
   * IMPORTANT:
   *
   * The analysis queue is now backed by the real NestJS QueryService.
   *
   * This replaces the previous placeholder processor and makes
   * processAnalysisJob() the actual execution boundary for:
   *
   * - SQL jobs
   * - natural-language jobs
   * - multi-dataset SQL jobs
   * - multi-dataset natural-language jobs
   *
   * BullMQ handles the queue lifecycle and retry behavior.
   */
  analysisWorker =
    new Worker<AnalysisJobData>(
      'analysis',
      async (job) => {
        logger.log(
          `[analysis] Processing job ${job.id}`,
        );

        logger.log(
          '[analysis] Job data:',
          job.data,
        );

        await updateProgress(
          job,
          {
            stage: 'started',
            percent: 0,
          },
        );

        try {
          const result =
            await withTimeout(
              queryService.processAnalysisJob(
                job,
              ),
              analysisJobTimeoutMs,
              `Analysis job ${job.id} timed out after ${analysisJobTimeoutMs}ms`,
            );

          await updateProgress(
            job,
            {
              stage: 'completed',
              percent: 100,
            },
          );

          return result;
        } catch (error) {
          const workerError =
            toWorkerError(
              error,
            );

          await updateProgress(
            job,
            {
              stage: 'failed',
              percent: 100,
            },
          );

          throw workerError;
        }
      },
      {
        connection:
          redisConnection,

        concurrency:
          analysisConcurrency,

        lockDuration:
          lockDurationMs,

        stalledInterval:
          stalledIntervalMs,

        maxStalledCount,
      },
    );

  registerAnalysisWorkerEvents(
    analysisWorker,
  );

  /*
   * Dataset ingestion remains a separate queue and worker.
   *
   * The Nest application context now owns the TypeORM DataSource,
   * so the worker no longer creates a second independent database
   * connection pool for ingestion.
   */
  datasetIngestionWorker =
    new Worker(
      'dataset_ingestion',
      async (job) => {
        const {
          datasetId,
          workspaceId,
        } =
          job.data as {
            datasetId?: string;
            workspaceId?: string;
          };

        logger.log(
          `[dataset_ingestion] Processing job ${job.id}`,
        );

        if (
          !datasetId ||
          !workspaceId
        ) {
          throw new UnrecoverableError(
            'Dataset ingestion job is missing datasetId or workspaceId',
          );
        }

        try {
          return await withTimeout(
            processDataset(
              dataSource,
              datasetId,
              workspaceId,
              job,
            ),
            datasetIngestionJobTimeoutMs,
            `Dataset ingestion job ${job.id} timed out after ${datasetIngestionJobTimeoutMs}ms`,
          );
        } catch (error) {
          throw toWorkerError(
            error,
          );
        }
      },
      {
        connection:
          redisConnection,

        concurrency:
          datasetIngestionConcurrency,

        lockDuration:
          lockDurationMs,

        stalledInterval:
          stalledIntervalMs,

        maxStalledCount,
      },
    );

  registerDatasetIngestionWorkerEvents(
    datasetIngestionWorker,
  );

  cleanupTimer =
    setInterval(
      () => {
        void runCleanup();
      },
      cleanupIntervalMs,
    );

  await runCleanup();

  logger.log(
    'Analysis worker started',
  );

  logger.log(
    `Analysis worker concurrency: ${analysisConcurrency}`,
  );

  logger.log(
    `Analysis job timeout: ${analysisJobTimeoutMs}ms`,
  );

  logger.log(
    'Dataset ingestion worker started',
  );

  logger.log(
    `Dataset ingestion worker concurrency: ${datasetIngestionConcurrency}`,
  );

  logger.log(
    `Dataset ingestion job timeout: ${datasetIngestionJobTimeoutMs}ms`,
  );

  logger.log(
    `BullMQ cleanup interval: ${cleanupIntervalMs}ms`,
  );

  logger.log(
    `BullMQ completed-job grace: ${completedJobCleanupGraceMs}ms`,
  );

  logger.log(
    `BullMQ failed-job grace: ${failedJobCleanupGraceMs}ms`,
  );

  logger.log(
    `BullMQ stalled interval: ${stalledIntervalMs}ms`,
  );

  logger.log(
    `BullMQ max stalled count: ${maxStalledCount}`,
  );

  logger.log(
    `BullMQ lock duration: ${lockDurationMs}ms`,
  );
}

/* -------------------------------------------------------------------------- */
/*                         Graceful shutdown                                  */
/* -------------------------------------------------------------------------- */

async function shutdown(
  signal: string,
): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.log(
    `Received ${signal}. Shutting down workers...`,
  );

  if (cleanupTimer) {
    clearInterval(
      cleanupTimer,
    );

    cleanupTimer = null;
  }

  try {
    const workers =
      [
        analysisWorker,
        datasetIngestionWorker,
      ].filter(
        (
          worker,
        ): worker is
          Worker =>
          worker !== null,
      );

    if (workers.length > 0) {
      await Promise.all(
        workers.map(
          (worker) =>
            worker.close(),
        ),
      );
    }

    await Promise.all([
      analysisQueue.close(),
      datasetIngestionQueue.close(),
    ]);

    if (applicationContext) {
      await applicationContext.close();
      applicationContext = null;
    }

    logger.log(
      'Workers shut down cleanly',
    );
  } catch (error) {
    logger.error(
      'Worker shutdown failed:',
      error,
    );

    process.exitCode = 1;
  }
}

/* -------------------------------------------------------------------------- */
/*                         Process signal handlers                            */
/* -------------------------------------------------------------------------- */

process.once(
  'SIGINT',
  () => {
    void shutdown(
      'SIGINT',
    );
  },
);

process.once(
  'SIGTERM',
  () => {
    void shutdown(
      'SIGTERM',
    );
  },
);

process.once(
  'uncaughtException',
  (error) => {
    logger.error(
      'Uncaught exception in worker process:',
      error,
    );

    void shutdown(
      'uncaughtException',
    );
  },
);

process.once(
  'unhandledRejection',
  (reason) => {
    logger.error(
      'Unhandled rejection in worker process:',
      reason,
    );

    void shutdown(
      'unhandledRejection',
    );
  },
);

/* -------------------------------------------------------------------------- */
/*                                Startup                                     */
/* -------------------------------------------------------------------------- */

try {
  await bootstrapWorkers();
} catch (error) {
  logger.error(
    'Worker startup failed:',
    error,
  );

  await shutdown(
    'startup-failure',
  );

  process.exitCode = 1;
}