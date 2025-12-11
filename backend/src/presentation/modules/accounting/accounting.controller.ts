import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  SearchBySoNumberQuery,
  SearchByVehicleNumberQuery,
} from '../../../application/accounting/accounting.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser, UserRole } from '~/enums/index';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Accounting')
@Controller('accounting')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(UserRole.ACCOUNTANT, UserRole.ADMIN)
@ApiBearerAuth('access-token')
export class AccountingController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search for sales orders by SO number or vehicle number (for accountant)',
  })
  @ApiQuery({
    name: 'soNumber',
    required: false,
    description: 'Search by sales order number',
  })
  @ApiQuery({
    name: 'vehicleNumber',
    required: false,
    description: 'Search by vehicle number (only returns SOs with open vehicle status)',
  })
  async search(
    @Query('soNumber') soNumber?: string,
    @Query('vehicleNumber') vehicleNumber?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (soNumber) {
      return this.queryBus.execute(new SearchBySoNumberQuery(user.tenantId, soNumber));
    } else if (vehicleNumber) {
      return this.queryBus.execute(
        new SearchByVehicleNumberQuery(user.tenantId, vehicleNumber),
      );
    } else {
      return [];
    }
  }
}

