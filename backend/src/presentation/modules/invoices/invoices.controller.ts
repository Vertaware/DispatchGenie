import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  CreateInvoiceCommand,
  ExportInvoicesQuery,
  GetInvoiceQuery,
  ListInvoicesQuery,
  MarkInvoicePaidCommand,
} from '../../../application/invoices/invoices.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { UserRole } from '../../../shared/enums/index';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/enums/index';
import { FileInterceptor } from '@nestjs/platform-express';
import { type Express, Response } from 'express';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('access-token')
export class InvoicesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('invoicePdf'))
  @ApiOperation({ summary: 'Create an invoice with an optional PDF attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        invoicePdf: { type: 'string', format: 'binary', nullable: true },
        invoiceNumber: { type: 'string' },
        date: { type: 'string', format: 'date' },
        vehicleIds: {
          type: 'array',
          items: {
            type: 'string',
          },
          example: ['6911cc7a9618f850269b492'],
        },
        overrideInvoiceAmount: { type: 'number', nullable: true },
      },
      required: ['invoiceNumber', 'date', 'vehicleIds'],
    },
  })
  async create(
    @UploadedFile() invoicePdf: Express.Multer.File | undefined,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandBus.execute(
      new CreateInvoiceCommand(
        user.tenantId,
        dto.invoiceNumber,
        dto.date,
        dto.vehicleIds,
        dto.overrideInvoiceAmount,
        invoicePdf
          ? {
              buffer: invoicePdf.buffer,
              mimeType: invoicePdf.mimetype,
              originalName: invoicePdf.originalname,
            }
          : null,
      ),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List invoices' })
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
      new ListInvoicesQuery(
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
  @ApiOperation({ summary: 'Export invoices as an Excel spreadsheet' })
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
      new ExportInvoicesQuery(user.tenantId, filterCopy, sortBy, sortOrder),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an invoice' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queryBus.execute(new GetInvoiceQuery(user.tenantId, id));
  }

  @Post(':id/mark-paid')
  @ApiOperation({ summary: 'Mark an invoice as paid' })
  async markPaid(
    @Param('id') id: string,
    @Body() dto: MarkInvoicePaidDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandBus.execute(
      new MarkInvoicePaidCommand(user.tenantId, id, dto.paidAmount, dto.paidDate),
    );
  }
}
