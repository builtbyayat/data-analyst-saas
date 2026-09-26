import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  In,
  Repository,
} from 'typeorm';

import {
  SavedAnalysis,
} from './saved-analysis.entity.js';

import {
  Report,
} from './report.entity.js';

export interface CreateReportInput {
  title?: string;
  description?: string | null;
  savedAnalysisIds?: string[];
}

export interface UpdateReportInput {
  title?: string;
  description?: string | null;
  savedAnalysisIds?: string[];
}

export interface ReportResponse {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  description: string | null;
  savedAnalysisIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MAX_REPORT_TITLE_LENGTH = 200;

const MAX_REPORT_DESCRIPTION_LENGTH = 2000;

const MAX_REPORT_ITEMS = 50;

const DEFAULT_REPORT_LIMIT = 50;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    @InjectRepository(SavedAnalysis)
    private readonly savedAnalysisRepository:
      Repository<SavedAnalysis>,
  ) {}

  async createForUser(
    workspaceId: string,
    userId: string,
    input: CreateReportInput,
  ): Promise<ReportResponse> {
    const title = this.normalizeTitle(
      input.title,
    );

    const description =
      this.normalizeDescription(
        input.description,
      );

    const savedAnalysisIds =
      this.normalizeSavedAnalysisIds(
        input.savedAnalysisIds,
      );

    await this.assertSavedAnalysesBelongToUser(
      workspaceId,
      userId,
      savedAnalysisIds,
    );

    const report =
      this.reportRepository.create({
        workspaceId,
        userId,
        title,
        description,
        savedAnalysisIds,
      });

    const saved =
      await this.reportRepository.save(
        report,
      );

    return this.toResponse(saved);
  }

  async listForUser(
    workspaceId: string,
    userId: string,
    limit?: number,
  ): Promise<ReportResponse[]> {
    const safeLimit =
      this.normalizeLimit(limit);

    const reports =
      await this.reportRepository.find({
        where: {
          workspaceId,
          userId,
        },
        order: {
          createdAt: 'DESC',
        },
        take: safeLimit,
      });

    return reports.map(
      (report) =>
        this.toResponse(report),
    );
  }

  async getForUser(
    workspaceId: string,
    userId: string,
    reportId: string,
  ): Promise<ReportResponse> {
    const normalizedId =
      this.requireUuid(
        reportId,
        'Report ID is required',
      );

    const report =
      await this.reportRepository.findOne({
        where: {
          id: normalizedId,
          workspaceId,
          userId,
        },
      });

    if (!report) {
      throw new NotFoundException(
        'Report not found',
      );
    }

    return this.toResponse(report);
  }

  async updateForUser(
    workspaceId: string,
    userId: string,
    reportId: string,
    input: UpdateReportInput,
  ): Promise<ReportResponse> {
    const normalizedId =
      this.requireUuid(
        reportId,
        'Report ID is required',
      );

    const report =
      await this.reportRepository.findOne({
        where: {
          id: normalizedId,
          workspaceId,
          userId,
        },
      });

    if (!report) {
      throw new NotFoundException(
        'Report not found',
      );
    }

    if (
      input.title !== undefined
    ) {
      report.title =
        this.normalizeTitle(
          input.title,
        );
    }

    if (
      input.description !== undefined
    ) {
      report.description =
        this.normalizeDescription(
          input.description,
        );
    }

    if (
      input.savedAnalysisIds !==
      undefined
    ) {
      const savedAnalysisIds =
        this.normalizeSavedAnalysisIds(
          input.savedAnalysisIds,
        );

      await this.assertSavedAnalysesBelongToUser(
        workspaceId,
        userId,
        savedAnalysisIds,
      );

      report.savedAnalysisIds =
        savedAnalysisIds;
    }

    const updated =
      await this.reportRepository.save(
        report,
      );

    return this.toResponse(updated);
  }

  async removeForUser(
    workspaceId: string,
    userId: string,
    reportId: string,
  ): Promise<void> {
    const normalizedId =
      this.requireUuid(
        reportId,
        'Report ID is required',
      );

    const result =
      await this.reportRepository.delete({
        id: normalizedId,
        workspaceId,
        userId,
      });

    if (result.affected !== 1) {
      throw new NotFoundException(
        'Report not found',
      );
    }
  }

  private async assertSavedAnalysesBelongToUser(
    workspaceId: string,
    userId: string,
    savedAnalysisIds: string[],
  ): Promise<void> {
    if (
      savedAnalysisIds.length === 0
    ) {
      return;
    }

    const savedAnalyses =
      await this.savedAnalysisRepository.find({
        where: {
          id: In(
            savedAnalysisIds,
          ),
          workspaceId,
          userId,
        },
        select: {
          id: true,
        },
      });

    const foundIds =
      new Set(
        savedAnalyses.map(
          (analysis) =>
            analysis.id,
        ),
      );

    const missingIds =
      savedAnalysisIds.filter(
        (id) =>
          !foundIds.has(id),
      );

    if (
      missingIds.length > 0
    ) {
      throw new NotFoundException(
        'One or more saved analyses were not found for this user and workspace',
      );
    }
  }

  private normalizeTitle(
    value: string | undefined,
  ): string {
    const normalized =
      typeof value === 'string'
        ? value.trim()
        : '';

    if (!normalized) {
      throw new BadRequestException(
        'Report title is required',
      );
    }

    if (
      normalized.length >
      MAX_REPORT_TITLE_LENGTH
    ) {
      throw new BadRequestException(
        `Report title must be ${MAX_REPORT_TITLE_LENGTH} characters or fewer`,
      );
    }

    return normalized;
  }

  private normalizeDescription(
    value: string | null | undefined,
  ): string | null {
    if (
      value === undefined ||
      value === null
    ) {
      return null;
    }

    const normalized =
      value.trim();

    if (
      !normalized
    ) {
      return null;
    }

    if (
      normalized.length >
      MAX_REPORT_DESCRIPTION_LENGTH
    ) {
      throw new BadRequestException(
        `Report description must be ${MAX_REPORT_DESCRIPTION_LENGTH} characters or fewer`,
      );
    }

    return normalized;
  }

  private normalizeSavedAnalysisIds(
    value: string[] | undefined,
  ): string[] {
    if (
      !Array.isArray(value)
    ) {
      throw new BadRequestException(
        'savedAnalysisIds must be an array of saved analysis IDs',
      );
    }

    const normalized =
      Array.from(
        new Set(
          value
            .filter(
              (
                id,
              ): id is string =>
                typeof id ===
                  'string' &&
                id.trim()
                  .length > 0,
            )
            .map(
              (id) =>
                id.trim(),
            ),
        ),
      );

    if (
      normalized.length === 0
    ) {
      throw new BadRequestException(
        'At least one saved analysis is required for a report',
      );
    }

    if (
      normalized.length >
      MAX_REPORT_ITEMS
    ) {
      throw new BadRequestException(
        `A report can contain at most ${MAX_REPORT_ITEMS} saved analyses`,
      );
    }

    for (const id of normalized) {
      if (
        !UUID_PATTERN.test(id)
      ) {
        throw new BadRequestException(
          'savedAnalysisIds must contain valid UUIDs',
        );
      }
    }

    return normalized;
  }

  private requireUuid(
    value: string,
    message: string,
  ): string {
    const normalized =
      typeof value === 'string'
        ? value.trim()
        : '';

    if (
      !normalized
    ) {
      throw new BadRequestException(
        message,
      );
    }

    if (
      !UUID_PATTERN.test(
        normalized,
      )
    ) {
      throw new BadRequestException(
        'Report ID must be a valid UUID',
      );
    }

    return normalized;
  }

  private normalizeLimit(
    limit?: number,
  ): number {
    if (
      limit === undefined ||
      !Number.isFinite(limit)
    ) {
      return DEFAULT_REPORT_LIMIT;
    }

    const normalized =
      Math.floor(limit);

    if (
      normalized <= 0
    ) {
      return DEFAULT_REPORT_LIMIT;
    }

    return Math.min(
      normalized,
      100,
    );
  }

  private toResponse(
    report: Report,
  ): ReportResponse {
    return {
      id: report.id,
      workspaceId:
        report.workspaceId,
      userId:
        report.userId,
      title: report.title,
      description:
        report.description,
      savedAnalysisIds:
        [...report.savedAnalysisIds],
      createdAt:
        report.createdAt,
      updatedAt:
        report.updatedAt,
    };
  }
}