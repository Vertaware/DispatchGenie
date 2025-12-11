import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserCommand, ListUsersQuery } from '../../../application/users/user.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { UserRole } from '~/enums/index';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '~/enums/index';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('access-token')
export class UsersController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  @ApiOperation({ summary: 'Invite a new user to the tenant' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(
      new CreateUserCommand(user.tenantId, dto.email, dto.name, dto.role),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List users in the current tenant' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
  ) {
    return this.queryBus.execute(
      new ListUsersQuery(user.tenantId, Number(page), Number(pageSize)),
    );
  }
}
