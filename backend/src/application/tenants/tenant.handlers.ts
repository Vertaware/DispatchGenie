import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { StripeService } from '../../infrastructure/adapters/stripe.service';
import { TenantDto, TenantSubscriptionStatus, UserRole } from '~/enums/index';
import {
  TenantSubscriptionStatus as PrismaTenantSubscriptionStatus,
  UserRole as PrismaUserRole,
} from '@prisma/client';

const mapSubscriptionStatus = (
  status: PrismaTenantSubscriptionStatus,
): TenantSubscriptionStatus => status as TenantSubscriptionStatus;

export class CreateTenantCommand {
  constructor(
    public readonly name: string,
    public readonly slug: string,
    public readonly subscriptionStatus: TenantSubscriptionStatus = TenantSubscriptionStatus.TRIAL,
  ) {}
}

export class GetTenantQuery {
  constructor(public readonly id: string) {}
}

export class PublicTenantSignupCommand {
  constructor(
    public readonly name: string,
    public readonly slug: string,
    public readonly adminEmail: string,
    public readonly adminName: string,
  ) {}
}

@CommandHandler(CreateTenantCommand)
export class CreateTenantHandler implements ICommandHandler<CreateTenantCommand, TenantDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async execute(command: CreateTenantCommand): Promise<TenantDto> {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: command.slug } });
    if (existing) {
      throw new ConflictException('Tenant slug already exists');
    }
    const now = new Date();
    const tenant = await this.prisma.tenant.create({
      data: {
        name: command.name,
        slug: command.slug,
        subscriptionStatus: command.subscriptionStatus as PrismaTenantSubscriptionStatus,
        isActive: true,
      },
    });

    await this.stripe.createCustomerForTenant(this.mapTenant(tenant));

    return this.mapTenant(tenant);
  }

  private mapTenant(tenant: any): TenantDto {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      stripeCustomerId: tenant.stripeCustomerId,
      subscriptionStatus: mapSubscriptionStatus(tenant.subscriptionStatus),
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(GetTenantQuery)
export class GetTenantHandler implements IQueryHandler<GetTenantQuery, TenantDto> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetTenantQuery): Promise<TenantDto> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: query.id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      stripeCustomerId: tenant.stripeCustomerId,
      subscriptionStatus: mapSubscriptionStatus(tenant.subscriptionStatus),
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }
}

@CommandHandler(PublicTenantSignupCommand)
export class PublicTenantSignupHandler
  implements ICommandHandler<PublicTenantSignupCommand, TenantDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: PublicTenantSignupCommand): Promise<TenantDto> {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: command.slug } });
    if (existing) {
      throw new ConflictException('Tenant slug already exists');
    }
    const tenant = await this.prisma.$transaction(async (tx) => {
      const trialEndsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const createdTenant = await tx.tenant.create({
        data: {
          name: command.name,
          slug: command.slug,
          subscriptionStatus: TenantSubscriptionStatus.TRIAL as PrismaTenantSubscriptionStatus,
          trialEndsAt,
          isActive: true,
        },
      });
      await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          email: command.adminEmail.toLowerCase(),
          name: command.adminName,
          role: UserRole.ADMIN as PrismaUserRole,
          isActive: true,
        },
      });
      return createdTenant;
    });
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      stripeCustomerId: tenant.stripeCustomerId,
      subscriptionStatus: mapSubscriptionStatus(tenant.subscriptionStatus),
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
    };
  }
}

export const TenantHandlers = [
  CreateTenantHandler,
  GetTenantHandler,
  PublicTenantSignupHandler,
];
