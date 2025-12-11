import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { PublicTenantSignupDto } from './dto/public-signup.dto';
import {
  CreateTenantCommand,
  GetTenantQuery,
  PublicTenantSignupCommand,
} from '../../../application/tenants/tenant.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { UserRole } from '../../shared/enums/index';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/enums/index';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Tenants')
@Controller()
export class TenantsController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post('tenants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new tenant within the current organization' })
  async create(@Body() dto: CreateTenantDto) {
    return this.commandBus.execute(
      new CreateTenantCommand(
        dto.name,
        dto.slug,
        dto.subscriptionStatus ?? undefined,
      ),
    );
  }

  @Get('tenants/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Retrieve tenant details',
    description: 'Admins can only access information for their own tenant.',
  })
  async getTenant(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.tenantId !== id) {
      // Prevent cross-tenant data leakage
      return this.queryBus.execute(new GetTenantQuery(user.tenantId));
    }
    return this.queryBus.execute(new GetTenantQuery(id));
  }

  @Post('public/tenants/signup')
  @ApiOperation({ summary: 'Register a new tenant via the public onboarding flow' })
  async publicSignup(@Body() dto: PublicTenantSignupDto) {
    return this.commandBus.execute(
      new PublicTenantSignupCommand(dto.name, dto.slug, dto.adminEmail, dto.adminName),
    );
  }
}
