import 'dotenv/config';
import 'reflect-metadata';

import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DataSource } from 'typeorm';
import { Worker } from 'bullmq';

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  DuckDBConnection,
  DuckDBInstance,
} from '@duckdb/node-api';

import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

import { User } from './users/user.entity.js';
import { Workspace } from './workspaces/workspace.entity.js';
import { WorkspaceMember } from './workspaces/workspace-member.entity.js';

import { Dataset } from './datasets/dataset.entity.js';
import { DatasetColumn } from './datasets/dataset-column.entity.js';

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',

  port: Number(
    process.env.REDIS_PORT ?? '6379',
  ),
};

const dataSource = new DataSource({
  type: 'postgres',

  host:
    process.env.DATABASE_HOST ?? 'localhost',

  port: Number(
    process.env.DATABASE_PORT ?? '5432',
  ),

  username:
    process.env.DATABASE_USER ?? 'app',

  password:
    process.env.DATABASE_PASSWORD ?? '',

  database:
    process.env.DATABASE_NAME ?? 'b2b_saas',

  entities: [
    User,
    Workspace,
    WorkspaceMember,
    Dataset,
    DatasetColumn,
  ],

  synchronize: false,
});

const s3Client = new S3Client({
  region:
    process.env.S3_REGION ?? 'us-east-1',

  endpoint:
    process.env.S3_ENDPOINT,

  forcePathStyle:
    (process.env.S3_FORCE_PATH_STYLE ?? 'true') ===
    'true',

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

type DatasetRecord = Record<
  string,
  string
>;

async function getObjectBuffer(
  objectKey: string,
): Promise<Buffer> {
  const response = await s3Client.send(
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
  const usedNames = new Map<
    string,
    number
  >();

  return headers.map(
    (header, index) => {
      const rawName =
        String(header ?? '').trim();

      const baseName =
        rawName ||
        `column_${index + 1}`;

      const previousCount =
        usedNames.get(baseName) ?? 0;

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
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as DatasetRecord[];
}

function parseExcel(
  buffer: Buffer,
): DatasetRecord[] {
  const workbook =
    XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
    });

  const firstSheetName =
    workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error(
      'Excel file contains no worksheets',
    );
  }

  const worksheet =
    workbook.Sheets[firstSheetName];

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
    matrix.filter((row) =>
      row.some(isMeaningfulValue),
    );

  if (nonEmptyRows.length === 0) {
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
        (row) => row.length,
      ),
    );

  const activeColumnIndexes: number[] =
    [];

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
      dataRows.some((row) =>
        isMeaningfulValue(
          row[index],
        ),
      );

    if (hasHeader || hasData) {
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
    normalizeHeaders(rawHeaders);

  return dataRows
    .filter((row) =>
      activeColumnIndexes.some(
        (index) =>
          isMeaningfulValue(
            row[index],
          ),
      ),
    )
    .map((row) => {
      const record: DatasetRecord =
        {};

      activeColumnIndexes.forEach(
        (columnIndex, index) => {
          record[headers[index]!] =
            String(
              row[columnIndex] ?? '',
            ).trim();
        },
      );

      return record;
    });
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
    normalizedType.includes('csv') ||
    normalizedFilename.endsWith('.csv');

  if (isCsv) {
    return parseCsv(buffer);
  }

  const isExcel =
    normalizedType.includes(
      'spreadsheet',
    ) ||
    normalizedType.includes(
      'ms-excel',
    ) ||
    normalizedFilename.endsWith('.xlsx') ||
    normalizedFilename.endsWith('.xls');

  if (isExcel) {
    return parseExcel(buffer);
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
    /[",\r\n]/.test(text)
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
      .map(escapeCsvValue)
      .join(',');

  const rows =
    records.map((record) =>
      columnNames
        .map((columnName) =>
          escapeCsvValue(
            record[columnName] ?? '',
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
  if (columnNames.length === 0) {
    throw new Error(
      'Dataset contains no columns',
    );
  }

  if (records.length === 0) {
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

async function processDataset(
  datasetId: string,
  workspaceId: string,
) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();

    console.log(
      '[dataset_ingestion] Database connection initialized',
    );
  }

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

    console.log(
      `[dataset_ingestion] Reading object: ${dataset.objectKey}`,
    );

    const buffer =
      await getObjectBuffer(
        dataset.objectKey,
      );

    console.log(
      `[dataset_ingestion] Downloaded ${buffer.length} bytes`,
    );

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

    console.log(
      `[dataset_ingestion] Rows: ${records.length}`,
    );

    console.log(
      `[dataset_ingestion] Columns: ${columnNames.length}`,
    );

    console.log(
      '[dataset_ingestion] Column names:',
      columnNames,
    );

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

    if (columns.length > 0) {
      await columnRepository.save(
        columns,
      );
    }

    console.log(
      '[dataset_ingestion] Generating Parquet file',
    );

    const parquetBuffer =
      await generateParquet(
        records,
        columnNames,
      );

    console.log(
      `[dataset_ingestion] Generated Parquet: ${parquetBuffer.length} bytes`,
    );

    const queryObjectKey =
      `workspaces/${workspaceId}/datasets/${dataset.id}/query.parquet`;

    await uploadObject(
      queryObjectKey,
      parquetBuffer,
      'application/vnd.apache.parquet',
    );

    console.log(
      `[dataset_ingestion] Uploaded query object: ${queryObjectKey}`,
    );

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

    console.log(
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

const analysisWorker = new Worker(
  'analysis',
  async (job) => {
    console.log(
      `[analysis] Processing job ${job.id}`,
    );

    console.log(
      '[analysis] Job data:',
      job.data,
    );

    return {
      success: true,
    };
  },
  {
    connection:
      redisConnection,
  },
);

const datasetIngestionWorker =
  new Worker(
    'dataset_ingestion',
    async (job) => {
      const {
        datasetId,
        workspaceId,
      } = job.data as {
        datasetId: string;
        workspaceId: string;
      };

      console.log(
        `[dataset_ingestion] Processing job ${job.id}`,
      );

      const result =
        await processDataset(
          datasetId,
          workspaceId,
        );

      return result;
    },
    {
      connection:
        redisConnection,
    },
  );

analysisWorker.on(
  'completed',
  (job) => {
    console.log(
      `[analysis] Job ${job.id} completed`,
    );
  },
);

analysisWorker.on(
  'failed',
  (job, error) => {
    console.error(
      `[analysis] Job ${job?.id} failed:`,
      error,
    );
  },
);

analysisWorker.on(
  'error',
  (error) => {
    console.error(
      '[analysis] Worker error:',
      error,
    );
  },
);

datasetIngestionWorker.on(
  'completed',
  (job) => {
    console.log(
      `[dataset_ingestion] Job ${job.id} completed`,
    );
  },
);

datasetIngestionWorker.on(
  'failed',
  (job, error) => {
    console.error(
      `[dataset_ingestion] Job ${job?.id} failed:`,
      error,
    );
  },
);

datasetIngestionWorker.on(
  'error',
  (error) => {
    console.error(
      '[dataset_ingestion] Worker error:',
      error,
    );
  },
);

console.log(
  'Analysis worker started',
);

console.log(
  'Dataset ingestion worker started',
);