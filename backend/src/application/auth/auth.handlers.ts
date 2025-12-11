import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SendGridEmailService } from '../../infrastructure/adapters/sendgrid.adapter';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, UserRole } from '../../shared/enums/index';
import * as bcrypt from 'bcryptjs';

export class RequestOtpCommand {
  constructor(public readonly tenantSlug: string, public readonly email: string) {}
}

export class VerifyOtpCommand {
  constructor(
    public readonly tenantSlug: string,
    public readonly email: string,
    public readonly code: string,
  ) {}
}

export class GetMeQuery {
  constructor(public readonly user: AuthenticatedUser) {}
}

export interface AuthTokenResponse {
  token: string;
  user: AuthenticatedUser;
}

@CommandHandler(RequestOtpCommand)
export class RequestOtpHandler implements ICommandHandler<RequestOtpCommand, void> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: SendGridEmailService,
  ) {}

  async execute(command: RequestOtpCommand): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: command.tenantSlug },
    });
    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant credentials');
    }
    const user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: command.email.toLowerCase() },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    const code = this.generateOtp();
    const hash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastOtpCodeHash: hash,
        lastOtpExpiresAt: expiresAt,
        otpFailedAttempts: 0,
      },
    });

    await this.emailService.sendOtpEmail({
      to: user.email,
      code,
      tenantName: tenant.name,
    });
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

@CommandHandler(VerifyOtpCommand)
export class VerifyOtpHandler implements ICommandHandler<VerifyOtpCommand, AuthTokenResponse> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: VerifyOtpCommand): Promise<AuthTokenResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: command.tenantSlug },
    });
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Tenant inactive');
    }
    const user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: command.email.toLowerCase() },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.lastOtpCodeHash || !user.lastOtpExpiresAt) {
      throw new UnauthorizedException('OTP not requested');
    }

    if (user.otpFailedAttempts >= 5) {
      throw new UnauthorizedException('Too many failed attempts');
    }
    if (user.lastOtpExpiresAt.getTime() < Date.now()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpFailedAttempts: user.otpFailedAttempts + 1 },
      });
      throw new UnauthorizedException('OTP expired');
    }

    const valid = await bcrypt.compare(command.code, user.lastOtpCodeHash);
    if (!valid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpFailedAttempts: user.otpFailedAttempts + 1 },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    const tokenPayload: AuthenticatedUser = {
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role as UserRole,
    };

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastOtpCodeHash: null,
        lastOtpExpiresAt: null,
        otpFailedAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    const token = await this.jwtService.signAsync(tokenPayload);
    return { token, user: tokenPayload };
  }
}

@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery, AuthenticatedUser> {
  async execute(query: GetMeQuery): Promise<AuthenticatedUser> {
    if (!query.user) {
      throw new BadRequestException('User context missing');
    }
    return query.user;
  }
}

export const AuthHandlers = [RequestOtpHandler, VerifyOtpHandler, GetMeHandler];
