import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import type {
  Request as ExpressRequest,
} from 'express';

import {
  WorkspaceAccessService,
} from '../workspaces/workspace-access.service.js';

import {
  ReportExportService,
} from './report-export.service.js';

import {
  ReportPresentationService,
} from './report-presentation.service.js';

import {
  CreateReportShareInput,
  ReportShareService,
} from './report-share.service.js';

interface AuthenticatedRequest
  extends ExpressRequest {
  user: {
    id?: string;
    userId?: string;
    sub?: string;
  };
}

const REPORT_EXPORT_FORMATS = [
  'json',
  'csv',
  'xlsx',
] as const;

type ReportExportFormat =
  (typeof REPORT_EXPORT_FORMATS)[number];

interface CreateShareBody
  extends CreateReportShareInput {}

@Controller()
export class ReportSharingController {
  constructor(
    private readonly workspaceAccessService:
      WorkspaceAccessService,

    private readonly reportPresentationService:
      ReportPresentationService,

    private readonly reportShareService:
      ReportShareService,

    private readonly reportExportService:
      ReportExportService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get(
    'workspaces/:workspaceId/reports/:reportId/generated',
  )
  async generateReport(
    @Param('workspaceId')
    workspaceId: string,

    @Param('reportId')
    reportId: string,

    @Request()
    request: AuthenticatedRequest,
  ) {
    const userId =
      this.getUserId(request);

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.reportPresentationService.generateForUser(
      workspaceId,
      userId,
      reportId.trim(),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(
    'workspaces/:workspaceId/reports/:reportId/export',
  )
  async exportReport(
    @Param('workspaceId')
    workspaceId: string,

    @Param('reportId')
    reportId: string,

    @Request()
    request: AuthenticatedRequest,

    @Query('format')
    format?: string,
  ): Promise<StreamableFile> {
    const userId =
      this.getUserId(request);

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    const report =
      await this.reportPresentationService.generateForUser(
        workspaceId,
        userId,
        reportId.trim(),
      );

    return this.createExportFile(
      report,
      this.normalizeFormat(format),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(
    'workspaces/:workspaceId/reports/:reportId/shares',
  )
  async createShare(
    @Param('workspaceId')
    workspaceId: string,

    @Param('reportId')
    reportId: string,

    @Body()
    body: CreateShareBody,

    @Request()
    request: AuthenticatedRequest,
  ) {
    const userId =
      this.getUserId(request);

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.reportShareService.createForUser(
      workspaceId,
      userId,
      reportId.trim(),
      body ?? {},
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(
    'workspaces/:workspaceId/reports/:reportId/shares',
  )
  async listShares(
    @Param('workspaceId')
    workspaceId: string,

    @Param('reportId')
    reportId: string,

    @Request()
    request: AuthenticatedRequest,
  ) {
    const userId =
      this.getUserId(request);

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    return this.reportShareService.listForUser(
      workspaceId,
      userId,
      reportId.trim(),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(
    'workspaces/:workspaceId/reports/:reportId/shares/:shareId',
  )
  async revokeShare(
    @Param('workspaceId')
    workspaceId: string,

    @Param('reportId')
    reportId: string,

    @Param('shareId')
    shareId: string,

    @Request()
    request: AuthenticatedRequest,
  ): Promise<void> {
    const userId =
      this.getUserId(request);

    await this.workspaceAccessService.requireMembership(
      userId,
      workspaceId,
    );

    await this.reportShareService.revokeForUser(
      workspaceId,
      userId,
      reportId.trim(),
      shareId.trim(),
    );
  }

  @Get(
    'shared/reports/:token',
  )
  async getSharedReport(
    @Param('token') token: string,
  ) {
    return this.reportShareService.resolveSharedReport(
      token,
    );
  }

  @Get(
    'shared/reports/:token/export',
  )
  async exportSharedReport(
    @Param('token') token: string,

    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    const shared =
      await this.reportShareService.assertCanExport(
        token,
      );

    return this.createExportFile(
      shared.report,
      this.normalizeFormat(format),
    );
  }

  private getUserId(
    request: AuthenticatedRequest,
  ): string {
    const userId =
      request.user?.userId ??
      request.user?.id ??
      request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    return userId;
  }

  private normalizeFormat(
    value: string | undefined,
  ): ReportExportFormat {
    const normalized =
      (value ?? 'xlsx')
        .trim()
        .toLowerCase();

    if (
      !REPORT_EXPORT_FORMATS.includes(
        normalized as ReportExportFormat,
      )
    ) {
      throw new BadRequestException(
        'format must be json, csv, or xlsx',
      );
    }

    return normalized as ReportExportFormat;
  }

  private createExportFile(
    report: Awaited<
      ReturnType<
        ReportPresentationService['generateForUser']
      >
    >,
    format: ReportExportFormat,
  ): StreamableFile {
    const safeTitle =
      report.report.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 70) ||
      'report';

    if (format === 'json') {
      const content =
        this.reportExportService.toJson(
          report,
        );

      return new StreamableFile(
        content,
        {
          type:
            'application/json; charset=utf-8',
          disposition:
            `attachment; filename="${safeTitle}.json"`,
          length: content.length,
        },
      );
    }

    if (format === 'csv') {
      const content =
        this.reportExportService.toCsv(
          report,
        );

      return new StreamableFile(
        content,
        {
          type:
            'text/csv; charset=utf-8',
          disposition:
            `attachment; filename="${safeTitle}.csv"`,
          length: content.length,
        },
      );
    }

    const content =
      this.reportExportService.toXlsx(
        report,
      );

    return new StreamableFile(
      content,
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition:
          `attachment; filename="${safeTitle}.xlsx"`,
        length: content.length,
      },
    );
  }
}
