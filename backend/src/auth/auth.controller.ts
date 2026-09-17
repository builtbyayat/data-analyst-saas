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
    if (!body.email || !body.password) {
      throw new BadRequestException(
        'Email and password are required',
      );
    }

    if (body.password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
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
  if (!body.email || !body.password) {
    throw new BadRequestException(
      'Email and password are required',
    );
  }

  return this.authService.login(
    body.email,
    body.password,
  );
}}