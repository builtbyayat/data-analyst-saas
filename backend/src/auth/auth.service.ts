import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { SecurityAuditService } from '../security/security-audit.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async register(
    email: string,
    password: string,
    name: string,
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser =
      await this.usersService.findByEmail(normalizedEmail);

    if (existingUser) {
      this.securityAuditService.record(
        'auth.register.conflict',
        { reason: 'email_already_registered', email: normalizedEmail },
      );

      throw new ConflictException(
        'Email is already registered',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.usersService.createUser(
      normalizedEmail,
      passwordHash,
      name,
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  async validateUser(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user =
      await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      this.securityAuditService.record(
        'auth.login.failed',
        { reason: 'invalid_credentials', email: normalizedEmail },
      );

      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      this.securityAuditService.record(
        'auth.login.failed',
        { reason: 'invalid_credentials', email: normalizedEmail },
      );

      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}