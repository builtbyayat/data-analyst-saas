import {
  Controller,
  Get,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { EntitlementsService } from './entitlements.service.js';

@Controller('workspaces')
export class EntitlementsController {
  constructor(
    private readonly entitlementsService: EntitlementsService,
  ) {}

  @UseGuards(
    AuthGuard('jwt'),
  )
  @Get(
    ':workspaceId/entitlements',
  )
  async listEntitlements(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param(
      'workspaceId',
    )
    workspaceId: string,
  ) {
    return this.entitlementsService.listForWorkspace(
      request.user.id,
      workspaceId,
    );
  }

  @UseGuards(
    AuthGuard('jwt'),
  )
  @Get(
    ':workspaceId/entitlements/:featureCode',
  )
  async checkEntitlement(
    @Request()
    request: {
      user: {
        id: string;
      };
    },

    @Param(
      'workspaceId',
    )
    workspaceId: string,

    @Param(
      'featureCode',
    )
    featureCode: string,
  ) {
    const enabled =
      await this.entitlementsService.hasFeature(
        request.user.id,
        workspaceId,
        featureCode,
      );

    return {
      workspaceId,

      featureCode,

      enabled,
    };
  }
}