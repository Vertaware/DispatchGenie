import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CheckInVehicleCommand,
  DeleteGateVehicleCommand,
  GateInVehicleCommand,
  GateOutVehicleCommand,
  ListGateVehiclesQuery,
  UpdateGateVehicleCommand,
} from '../../../application/gate/gate.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser, UserRole } from '~/enums/index';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Gate')
@Controller('gate')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class GateController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.LOGISTIC_WORKER,
    UserRole.SECURITY,
  )
  @ApiOperation({ summary: 'List active gate entries (excludes gate-out and cancelled entries)' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query() filters?: Record<string, string>,
  ) {
    const filterCopy = { ...filters };
    delete filterCopy.page;
    delete filterCopy.pageSize;
    delete filterCopy.sortBy;
    delete filterCopy.sortOrder;
    return this.queryBus.execute(
      new ListGateVehiclesQuery(
        user.tenantId,
        Number(page),
        Number(pageSize),
        sortBy,
        sortOrder,
        filterCopy,
      ),
    );
  }

  @Post(':id/gate-in')
  @Roles(UserRole.ADMIN, UserRole.SECURITY)
  @ApiOperation({ summary: 'Mark gate entry as gate-in' })
  async gateIn(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(new GateInVehicleCommand(user.tenantId, id));
  }

  @Post(':id/gate-out')
  @Roles(UserRole.ADMIN, UserRole.SECURITY)
  @ApiOperation({ summary: 'Mark gate entry as gate-out' })
  async gateOut(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(new GateOutVehicleCommand(user.tenantId, id));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SECURITY)
  @ApiOperation({ summary: 'Update gate entry information' })
  async update(
    @Param('id') id: string,
    @Body() payload: Record<string, any>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandBus.execute(
      new UpdateGateVehicleCommand(user.tenantId, id, payload),
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SECURITY)
  @ApiOperation({
    summary: 'Delete gate entry (only allowed before loading starts)',
  })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(new DeleteGateVehicleCommand(user.tenantId, id));
  }

  @Post('check-in')
  @Roles(UserRole.ADMIN, UserRole.SECURITY)
  @ApiOperation({
    summary: 'Create a new Check-In entry by vehicle number (links to SO if vehicle is assigned)',
  })
  async checkIn(
    @Body() body: { vehicleNumber: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandBus.execute(
      new CheckInVehicleCommand(user.tenantId, body.vehicleNumber),
    );
  }
}

