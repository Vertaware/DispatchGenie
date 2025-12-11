import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import {
  CreateBeneficiaryCommand,
  ExportBeneficiariesQuery,
  GetBeneficiaryQuery,
  ListBeneficiariesQuery,
  UpdateBeneficiaryCommand,
} from '../../../application/beneficiaries/beneficiaries.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { UserRole } from '~/enums/index';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '~/enums/index';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Beneficiaries')
@Controller('beneficiaries')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
@ApiBearerAuth('access-token')
export class BeneficiariesController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  @ApiOperation({ summary: 'Create a beneficiary' })
  async create(@Body() dto: CreateBeneficiaryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(
      new CreateBeneficiaryCommand(
        user.tenantId,
        dto.name,
        dto.accountNumber,
        dto.bankNameAndBranch,
        dto.ifscCode,
        dto.contactInfo,
        dto.documentId,
      ),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List beneficiaries' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
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
      new ListBeneficiariesQuery(
        user.tenantId,
        Number(page),
        Number(pageSize),
        sortBy,
        sortOrder,
        filterCopy,
      ),
    );
  }

  @Get('export')
  @ApiOperation({ summary: 'Export beneficiaries as an Excel spreadsheet' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async export(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query() filters?: Record<string, string>,
  ) {
    const filterCopy = { ...filters };
    delete filterCopy.sortBy;
    delete filterCopy.sortOrder;
    const { buffer, fileName } = await this.queryBus.execute(
      new ExportBeneficiariesQuery(user.tenantId, filterCopy, sortBy, sortOrder),
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a beneficiary' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queryBus.execute(new GetBeneficiaryQuery(user.tenantId, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a beneficiary' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBeneficiaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandBus.execute(
      new UpdateBeneficiaryCommand(user.tenantId, id, {
        ...dto,
      }),
    );
  }
}
