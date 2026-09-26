import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  In,
  Repository,
} from 'typeorm';

import { Report } from './report.entity.js';

import { SavedAnalysis } from './saved-analysis.entity.js';

export interface GeneratedReportSection {
  title: string;
  description: string | null;
  question: string | null;
  datasetCount: number;
  resultSnapshot: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedReport {
  report: {
    id: string;
    workspaceId: string;
    title: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  generatedAt: Date;
  sections: GeneratedReportSection[];
  missingSectionCount: number;
}

@Injectable()
export class ReportPresentationService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    @InjectRepository(SavedAnalysis)
    private readonly savedAnalysisRepository:
      Repository<SavedAnalysis>,
  ) {}

  async generateForUser(
    workspaceId: string,
    userId: string,
    reportId: string,
  ): Promise<GeneratedReport> {
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

    return this.generateFromReport(report);
  }

  async generateForShare(
    reportId: string,
  ): Promise<GeneratedReport> {
    const report =
      await this.reportRepository.findOne({
        where: {
          id: reportId,
        },
      });

    if (!report) {
      throw new NotFoundException(
        'Report not found',
      );
    }

    return this.generateFromReport(report);
  }

  private async generateFromReport(
    report: Report,
  ): Promise<GeneratedReport> {
    const requestedIds = [
      ...report.savedAnalysisIds,
    ];

    const analyses =
      requestedIds.length > 0
        ? await this.savedAnalysisRepository.find({
            where: {
              id: In(requestedIds),
              workspaceId: report.workspaceId,
              userId: report.userId,
            },
          })
        : [];

    const analysesById =
      new Map(
        analyses.map((analysis) => [
          analysis.id,
          analysis,
        ]),
      );

    const sections = requestedIds
      .map((analysisId) =>
        analysesById.get(analysisId),
      )
      .filter(
        (
          analysis,
        ): analysis is SavedAnalysis =>
          Boolean(analysis),
      )
      .map((analysis) => ({
        title: analysis.title,
        description: analysis.description,
        question: analysis.question,
        datasetCount:
          analysis.datasetIds.length,
        resultSnapshot:
          analysis.resultSnapshot,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
      }));

    return {
      report: {
        id: report.id,
        workspaceId: report.workspaceId,
        title: report.title,
        description: report.description,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      },
      generatedAt: new Date(),
      sections,
      missingSectionCount:
        requestedIds.length - sections.length,
    };
  }
}
