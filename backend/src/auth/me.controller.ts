import {
  Controller,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class MeController {
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Request() request: { user: unknown }) {
    return request.user;
  }
}