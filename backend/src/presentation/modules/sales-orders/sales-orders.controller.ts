import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { type Express, Response } from 'express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { IngestSalesOrderImageDto } from './dto/ingest-sales-order-image.dto';
import {
  CreateManualSalesOrderCommand,
  ExportSalesOrdersQuery,
  GetSalesOrderByNumberQuery,
  GetSalesOrderQuery,
  ImportSalesOrdersCommand,
  UpsertSalesOrderImageCommand,
  ListSalesOrdersQuery,
  SearchSalesOrdersQuery,
  UpdateManualSalesOrderCommand,
  HoldSalesOrderCommand,
  DeleteSalesOrderCommand,
  ReactivateSalesOrderCommand,
} from '../../../application/sales-orders/sales-orders.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { AuthenticatedUser, UserRole } from '../../../shared/enums/index';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Sales Orders')
@Controller('sales-orders')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@ApiBearerAuth('access-token')
export class SalesOrdersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a manual sales order' })
  async create(@Body() dto: CreateSalesOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(new CreateManualSalesOrderCommand(user.tenantId, dto, user.role));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a manual sales order' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandBus.execute(new UpdateManualSalesOrderCommand(user.tenantId, id, dto, user.role));
  }

  @Patch(':id/hold')
  @ApiOperation({ summary: 'Place a sales order on hold' })
  async hold(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(new HoldSalesOrderCommand(user.tenantId, id));
  }

  @Patch(':id/delete')
  @ApiOperation({ summary: 'Soft delete a sales order' })
  async softDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(new DeleteSalesOrderCommand(user.tenantId, id));
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a held or deleted sales order' })
  async reactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commandBus.execute(new ReactivateSalesOrderCommand(user.tenantId, id));
  }

  @Get()
  @ApiOperation({ summary: 'List sales orders' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'filters', required: false, type: 'object' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('filters') rawFilters?: Record<string, string>,
  ) {
    const filters = { ...rawFilters };
    delete filters.page;
    delete filters.pageSize;
    delete filters.sortBy;
    delete filters.sortOrder;
    return this.queryBus.execute(
      new ListSalesOrdersQuery(
        user.tenantId,
        Number(page),
        Number(pageSize),
        sortBy,
        sortOrder,
        filters,
        user.role,
      ),
    );
  }

  @Get('export')
  @ApiOperation({ summary: 'Export sales orders as an Excel spreadsheet' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async export(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query() rawFilters?: Record<string, string>,
  ) {
    const filters = { ...rawFilters };
    delete filters.sortBy;
    delete filters.sortOrder;
    const { buffer, fileName } = await this.queryBus.execute(
      new ExportSalesOrdersQuery(user.tenantId, filters, sortBy, sortOrder, user.role),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search sales orders for autocomplete (excludes orders with payments)' })
  @ApiQuery({ name: 'q', required: true, description: 'Search term for SO number' })
  @ApiQuery({
    name: 'excludeWithPayments',
    required: false,
    type: Boolean,
    description: 'Exclude sales orders that have payments (default: true)',
  })
  async search(
    @Query('q') searchTerm: string,
    @Query('excludeWithPayments') excludeWithPayments = 'true',
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queryBus.execute(
      new SearchSalesOrdersQuery(
        user.tenantId,
        searchTerm,
        excludeWithPayments === 'true',
      ),
    );
  }

  @Get('by-number/:soNumber')
  @ApiOperation({ summary: 'Retrieve a sales order by SO number with vehicle details' })
  async findByNumber(
    @Param('soNumber') soNumber: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queryBus.execute(
      new GetSalesOrderByNumberQuery(user.tenantId, soNumber, user.role),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a sales order' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queryBus.execute(new GetSalesOrderQuery(user.tenantId, id, user.role));
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk import sales orders from a spreadsheet' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  async import(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    if (!file) {
      throw new Error('File is required');
    }
    return this.commandBus.execute(
      new ImportSalesOrdersCommand(user.tenantId, file.originalname, file.buffer),
    );
  }

}
