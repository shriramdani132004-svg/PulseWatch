import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { CookieService } from './cookie.service';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from './auth.constants';
import type { RequestUser } from './types/request-user';

const DUMMY_PASSWORD_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5X9h1vM7jW4B7g1Q0l4bW3s5p1s3a2e';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly cookies: CookieService,
  ) {}

  private publicUser(user: Pick<User, 'id' | 'name' | 'email' | 'createdAt'>) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private refreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private async createSession(user: User, request: Request): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenHash = this.encryption.hashRefreshToken(refreshToken, this.refreshSecret());
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
        userAgent: request.headers['user-agent']?.slice(0, 255) ?? null,
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, sid: session.id, type: 'access' },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto, request: Request, response: Response) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UnauthorizedException('An account with that email already exists');
      }
      throw error;
    }
    const tokens = await this.createSession(user, request);
    this.cookies.setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
    return { user: this.publicUser(user) };
  }

  async login(dto: LoginDto, request: Request, response: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const tokens = await this.createSession(user, request);
    this.cookies.setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
    return { user: this.publicUser(user) };
  }

  async refresh(refreshToken: string | undefined, response: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh session is missing');
    }
    const currentHash = this.encryption.hashRefreshToken(refreshToken, this.refreshSecret());
    const nextToken = randomBytes(48).toString('base64url');
    const nextHash = this.encryption.hashRefreshToken(nextToken, this.refreshSecret());

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { refreshTokenHash: currentHash },
        include: { user: true },
      });
      if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Refresh session is invalid or expired');
      }
      const updated = await tx.session.updateMany({
        where: {
          id: session.id,
          refreshTokenHash: currentHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          refreshTokenHash: nextHash,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
          lastUsedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new UnauthorizedException('Refresh token has already been used');
      }
      return session;
    });

    const accessToken = await this.jwt.signAsync(
      { sub: result.user.id, email: result.user.email, sid: result.id, type: 'access' },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
    this.cookies.setAuthCookies(response, accessToken, nextToken);
    return { user: this.publicUser(result.user) };
  }

  async logout(refreshToken: string | undefined, response: Response): Promise<void> {
    if (refreshToken) {
      const hash = this.encryption.hashRefreshToken(refreshToken, this.refreshSecret());
      await this.prisma.session.updateMany({
        where: { refreshTokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.cookies.clearAuthCookies(response);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { user: this.publicUser(user) };
  }

  async validateAccessToken(payload: {
    sub?: string;
    email?: string;
    sid?: string;
    type?: string;
  }): Promise<RequestUser> {
    if (!payload.sub || !payload.sid || payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      sessionId: session.id,
    };
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  tokenFingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex').slice(0, 12);
  }
}
