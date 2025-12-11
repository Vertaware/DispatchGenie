import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthenticatedUser, TenantSubscriptionStatus } from '~/enums/index';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException('Unauthorized');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenException('Tenant inactive');
    }
    if (tenant.subscriptionStatus === TenantSubscriptionStatus.ACTIVE) {
      return true;
    }
    if (
      tenant.subscriptionStatus === TenantSubscriptionStatus.TRIAL &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt.getTime() > Date.now()
    ) {
      return true;
    }
    throw new HttpException(
      'Subscription inactive. Please renew subscription to continue.',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
