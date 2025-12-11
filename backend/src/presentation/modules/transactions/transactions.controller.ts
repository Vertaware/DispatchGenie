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
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  CreateBankTransactionCommand,
  ExportBankTransactionsQuery,
  GetBankTransactionQuery,
  GetBankTransactionRemainingBalanceQuery,
  ListAvailableBankTransactionsQuery,
  ListBankTransactionsQuery,
} from '../../../application/transactions/transactions.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { UserRole } from '~/enums/index';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '~/enums/index';
import { FileInterceptor } from '@nestjs/platform-express';
import { type Express, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
@ApiBearerAuth('access-token')
export class TransactionsController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  @UseInterceptors(FileInterceptor('paymentProof'))
  @ApiOperation({ summary: 'Record a bank transaction with proof of payment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        paymentProof: { type: 'string', format: 'binary' },
        transactionCode: { type: 'string' },
        transactionDate: { type: 'string', format: 'date-time' },
        beneficiaryId: { type: 'string' },
        totalPaidAmount: { type: 'number' },
      },
      required: ['paymentProof', 'transactionCode', 'transactionDate', 'beneficiaryId', 'totalPaidAmount'],
    },
  })
  async create(
    @UploadedFile() paymentProof: Express.Multer.File,
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!paymentProof) {
      throw new Error('paymentProof file required');
    }
    return this.commandBus.execute(
      new CreateBankTransactionCommand(
        user.tenantId,
        dto.transactionCode,
        dto.transactionDate,
        dto.beneficiaryId,
        dto.totalPaidAmount,
        {
        buffer: paymentProof.buffer,
        mimeType: paymentProof.mimetype,
        originalName: paymentProof.originalname,
        },
      ),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List bank transactions' })
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
      new ListBankTransactionsQuery(
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
  @ApiOperation({ summary: 'Export transactions as an Excel spreadsheet' })
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
      new ExportBankTransactionsQuery(user.tenantId, filterCopy, sortBy, sortOrder),
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get('available')
  @ApiOperation({ summary: 'List bank transactions with available balance for allocation' })
  @ApiQuery({ name: 'beneficiaryId', required: false, description: 'Filter by beneficiary ID' })
  async available(
    @CurrentUser() user: AuthenticatedUser,
    @Query('beneficiaryId') beneficiaryId?: string,
  ) {
    return this.queryBus.execute(
      new ListAvailableBankTransactionsQuery(user.tenantId, beneficiaryId),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a bank transaction' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queryBus.execute(new GetBankTransactionQuery(user.tenantId, id));
  }

  @Get(':id/remaining-balance')
  @ApiOperation({ summary: 'Get the remaining balance available to allocate' })
  async remaining(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queryBus.execute(
      new GetBankTransactionRemainingBalanceQuery(user.tenantId, id),
    );
  }
}
