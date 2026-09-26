import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  IsNull,
  Repository,
} from 'typeorm';

import {
  createHash,
  randomBytes,
} from 'node:crypto';

import { Report } from './report.entity.js';

import { ReportPresentationService } from './report-presentation.service.js';

import { ReportShareLink } from './report-share.entity.js';

export interface CreateReportShareInput {
  permission?: string;
  expiresInDays?: number;
}

export interface ReportShareResponse {
  id: string;
  reportId: string;
  permission: 'viewer' | 'exporter';
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  token?: string;
}

export interface SharedReportResponse {
  permission: 'viewer' | 'exporter';
  canExport: boolean;
  expiresAt: Date;
  report: Awaited<
    ReturnType<
      ReportPresentationService['generateForShare']
    >
  >;
}

const DEFAULT_EXPIRY_DAYS = 7;
const MAX_EXPIRY_DAYS = 30;
const TOKEN_BYTES = 32;

@Injectable()
export class ReportShareService {
  constructor(
    @InjectRepository(ReportShareLink)
    private readonly shareRepository:
      Repository<ReportShareLink>,

    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    private readonly reportPresentationService:
      ReportPresentationService,
  ) {}

  async createForUser(
    workspaceId: string,
    userId: string,
    reportId: string,
    input: CreateReportShareInput,
  ): Promise<ReportShareResponse> {
    await this.assertOwnedReport(
      workspaceId,
      userId,
      reportId,
    );

    const permission =
      this.normalizePermission(
        input.permission,
      );

    const expiresInDays =
      this.normalizeExpiry(
        input.expiresInDays,
      );

    const token =
      randomBytes(TOKEN_BYTES).toString(
        'hex',
      );

    const tokenHash =
      this.hashToken(token);

    const expiresAt =
      new Date(
        Date.now() +
          expiresInDays *
            24 *
            60 *
            60 *
            1000,
      );

    const share =
      this.shareRepository.create({
        reportId,
        workspaceId,
        createdByUserId: userId,
        permission,
        tokenHash,
        expiresAt,
        revokedAt: null,
      });

    const saved =
      await this.shareRepository.save(
        share,
      );

    return {
      ...this.toResponse(saved),
      token,
    };
  }

  async listForUser(
    workspaceId: string,
    userId: string,
    reportId: string,
  ): Promise<ReportShareResponse[]> {
    await this.assertOwnedReport(
      workspaceId,
      userId,
      reportId,
    );

    const shares =
      await this.shareRepository.find({
        where: {
          workspaceId,
          reportId,
          createdByUserId: userId,
        },
        order: {
          createdAt: 'DESC',
        },
      });

    return shares.map((share) =>
      this.toResponse(share),
    );
  }

  async revokeForUser(
    workspaceId: string,
    userId: string,
    reportId: string,
    shareId: string,
  ): Promise<void> {
    await this.assertOwnedReport(
      workspaceId,
      userId,
      reportId,
    );

    const share =
      await this.shareRepository.findOne({
        where: {
          id: shareId,
          workspaceId,
          reportId,
          createdByUserId: userId,
        },
      });

    if (!share) {
      throw new NotFoundException(
        'Report share link not found',
      );
    }

    if (!share.revokedAt) {
      share.revokedAt = new Date();
      await this.shareRepository.save(
        share,
      );
    }
  }

  async resolveSharedReport(
    token: string,
  ): Promise<SharedReportResponse> {
    const normalizedToken =
      token.trim();

    if (!normalizedToken) {
      throw new GoneException(
        'This report share link is no longer available',
      );
    }

    const share =
      await this.shareRepository.findOne({
        where: {
          tokenHash:
            this.hashToken(
              normalizedToken,
            ),
          revokedAt: IsNull(),
        },
      });

    if (!share) {
      throw new GoneException(
        'This report share link is no longer available',
      );
    }

    if (
      share.expiresAt.getTime() <=
      Date.now()
    ) {
      throw new GoneException(
        'This report share link has expired',
      );
    }

    const report =
      await this.reportPresentationService.generateForShare(
        share.reportId,
      );

    return {
      permission:
        share.permission,
      canExport:
        share.permission ===
        'exporter',
      expiresAt:
        share.expiresAt,
      report,
    };
  }

  async assertCanExport(
    token: string,
  ): Promise<SharedReportResponse> {
    const resolved =
      await this.resolveSharedReport(
        token,
      );

    if (!resolved.canExport) {
      throw new ForbiddenException(
        'This report share link does not allow exports',
      );
    }

    return resolved;
  }

  private async assertOwnedReport(
    workspaceId: string,
    userId: string,
    reportId: string,
  ): Promise<Report> {
    const report =
      await this.reportRepository.findOne({
        where: {
          id: reportId,
          workspaceId,
          userId,
        },
      });

    if (!report) {
      throw new NotFoundException(
        'Report not found',
      );
    }

    return report;
  }

  private normalizePermission(
    value: string | undefined,
  ): 'viewer' | 'exporter' {
    const permission =
      typeof value === 'string'
        ? value.trim().toLowerCase()
        : 'viewer';

    if (
      permission !== 'viewer' &&
      permission !== 'exporter'
    ) {
      throw new BadRequestException(
        'permission must be viewer or exporter',
      );
    }

    return permission;
  }

  private normalizeExpiry(
    value: number | undefined,
  ): number {
    const expiry =
      value === undefined
        ? DEFAULT_EXPIRY_DAYS
        : Number(value);

    if (
      !Number.isFinite(expiry) ||
      Math.floor(expiry) !== expiry ||
      expiry < 1 ||
      expiry > MAX_EXPIRY_DAYS
    ) {
      throw new BadRequestException(
        `expiresInDays must be an integer between 1 and ${MAX_EXPIRY_DAYS}`,
      );
    }

    return expiry;
  }

  private hashToken(
    token: string,
  ): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  private toResponse(
    share: ReportShareLink,
  ): ReportShareResponse {
    return {
      id: share.id,
      reportId: share.reportId,
      permission:
        share.permission,
      expiresAt:
        share.expiresAt,
      revokedAt:
        share.revokedAt,
      createdAt:
        share.createdAt,
    };
  }
}
