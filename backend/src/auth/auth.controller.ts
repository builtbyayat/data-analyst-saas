import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';

interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

interface LoginDto {
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    if (
      typeof body?.email !== 'string' ||
      typeof body?.password !== 'string'
    ) {
      throw new BadRequestException(
        'Email and password are required',
      );
    }

    if (body.password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    if (Buffer.byteLength(body.password, 'utf8') > 72) {
      throw new BadRequestException(
        'Password is too long for the configured password hashing scheme',
      );
    }

    if (body.email.trim().length > 320) {
      throw new BadRequestException(
        'Email address is too long',
      );
    }

    if (body.name !== undefined && body.name.length > 200) {
      throw new BadRequestException(
        'Name must be 200 characters or fewer',
      );
    }

    return this.authService.register(
      body.email,
      body.password,
      body.name?.trim() || '',
    );
  }

  @Post('login')
async login(@Body() body: LoginDto) {
  if (
    typeof body?.email !== 'string' ||
    typeof body?.password !== 'string'
  ) {
    throw new BadRequestException(
      'Email and password are required',
    );
  }

  if (Buffer.byteLength(body.password, 'utf8') > 72) {
    throw new BadRequestException(
      'Password is too long for the configured password hashing scheme',
    );
  }

  if (body.email.trim().length > 320) {
    throw new BadRequestException(
      'Email address is too long',
    );
  }

  return this.authService.login(
    body.email,
    body.password,
  );
}}