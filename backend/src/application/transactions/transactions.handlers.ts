import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from '@nestjs/cqrs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  BankTransactionDto,
  DocumentType,
  PaginatedResult,
} from '../../shared/enums/index';
import { DocumentManager, DocumentFilePayload } from '../../infrastructure/documents/document.manager';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';

type SortOrder = 'asc' | 'desc';

export class CreateBankTransactionCommand {
  constructor(
    public readonly tenantId: string,
    public readonly transactionCode: string,
    public readonly transactionDate: string,
    public readonly beneficiaryId: string,
    public readonly totalPaidAmount: number,
    public readonly paymentProof: DocumentFilePayload,
  ) {}
}

export class ListBankTransactionsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
    public readonly filters: Record<string, string>,
  ) {}
}

export class GetBankTransactionQuery {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}

export class GetBankTransactionRemainingBalanceQuery {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}

export class ListAvailableBankTransactionsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly beneficiaryId?: string,
  ) {}
}

export class ExportBankTransactionsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters: Record<string, string>,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
  ) {}
}

@CommandHandler(CreateBankTransactionCommand)
export class CreateBankTransactionHandler
  implements ICommandHandler<CreateBankTransactionCommand, BankTransactionDto>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentManager: DocumentManager,
  ) {}

  async execute(command: CreateBankTransactionCommand): Promise<BankTransactionDto> {
    if (command.totalPaidAmount <= 0) {
      throw new BadRequestException('totalPaidAmount must be greater than zero');
    }
    const document = await this.documentManager.createDocument(
      command.tenantId,
      DocumentType.PAYMENT_PROOF,
      command.paymentProof,
    );
    const transaction = await this.prisma.bankTransaction.create({
      data: {
        tenantId: command.tenantId,
        transactionCode: command.transactionCode,
        transactionDate: new Date(command.transactionDate),
        beneficiaryId: command.beneficiaryId,
        totalPaidAmount: command.totalPaidAmount,
        paymentDocumentId: document.id,
      } as any,
    });
    return this.map(transaction);
  }

  private map(tx: any): BankTransactionDto {
    return {
      id: tx.id,
      tenantId: tx.tenantId,
      transactionCode: tx.transactionCode,
      transactionDate: tx.transactionDate?.toISOString() ?? null,
      beneficiaryId: tx.beneficiaryId,
      totalPaidAmount: tx.totalPaidAmount,
      paymentDocumentId: tx.paymentDocumentId,
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(ListBankTransactionsQuery)
export class ListBankTransactionsHandler
  implements IQueryHandler<ListBankTransactionsQuery, PaginatedResult<BankTransactionDto>>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ListBankTransactionsQuery,
  ): Promise<PaginatedResult<BankTransactionDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === 'desc' ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.BankTransactionOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: direction } as Prisma.BankTransactionOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const [totalCount, transactions] = await this.prisma.$transaction([
      this.prisma.bankTransaction.count({ where }),
      this.prisma.bankTransaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          beneficiary: true,
        },
      }),
    ]);
    return {
      data: transactions.map((tx) => this.map(tx)),
      page,
      pageSize,
      totalCount,
    };
  }

  private buildWhere(tenantId: string, filters: Record<string, string>) {
    const where: any = { tenantId };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value) return;
      switch (key) {
        case 'beneficiaryId':
          where[key] = value;
          break;
        case 'transactionCode':
          where[key] = { contains: value, mode: 'insensitive' };
          break;
        case 'fromDate':
        case 'toDate':
          where.createdAt = where.createdAt ?? {};
          if (key === 'fromDate') {
            where.createdAt.gte = new Date(String(value));
          } else {
            where.createdAt.lte = new Date(String(value));
          }
          break;
        default:
          break;
      }
    });
    return where;
  }

  private map(tx: any): BankTransactionDto {
    return {
      id: tx.id,
      tenantId: tx.tenantId,
      transactionCode: tx.transactionCode,
      transactionDate: tx.transactionDate?.toISOString() ?? null,
      beneficiaryId: tx.beneficiaryId,
      totalPaidAmount: tx.totalPaidAmount,
      paymentDocumentId: tx.paymentDocumentId,
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(GetBankTransactionQuery)
export class GetBankTransactionHandler
  implements IQueryHandler<GetBankTransactionQuery, any>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetBankTransactionQuery): Promise<any> {
    const transaction = await this.prisma.bankTransaction.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
      include: {
        beneficiary: true,
        allocations: {
          include: {
            paymentRequest: {
              include: {
                salesOrder: true,
                vehicle: true,
              },
            },
          },
        },
      },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }
}

@QueryHandler(GetBankTransactionRemainingBalanceQuery)
export class GetBankTransactionRemainingBalanceHandler
  implements IQueryHandler<GetBankTransactionRemainingBalanceQuery, { remainingBalance: number }>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: GetBankTransactionRemainingBalanceQuery,
  ): Promise<{ remainingBalance: number }> {
    const transaction = await this.prisma.bankTransaction.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
      include: { allocations: true },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    const allocated = transaction.allocations.reduce(
      (sum, alloc) => sum + alloc.allocatedAmount,
      0,
    );
    return { remainingBalance: transaction.totalPaidAmount - allocated };
  }
}

@QueryHandler(ListAvailableBankTransactionsQuery)
export class ListAvailableBankTransactionsHandler
  implements
    IQueryHandler<
      ListAvailableBankTransactionsQuery,
      Array<BankTransactionDto & { remainingBalance: number }>
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ListAvailableBankTransactionsQuery,
  ): Promise<Array<BankTransactionDto & { remainingBalance: number }>> {
    const where: any = { tenantId: query.tenantId };

    // Filter by beneficiary if provided
    if (query.beneficiaryId) {
      where.beneficiaryId = query.beneficiaryId;
    }

    const transactions = await this.prisma.bankTransaction.findMany({
      where,
      include: {
        allocations: true,
        beneficiary: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter transactions that have remaining balance and map them
    return transactions
      .map((tx) => {
        const allocated = tx.allocations.reduce(
          (sum, alloc) => sum + alloc.allocatedAmount,
          0,
        );
        const remainingBalance = tx.totalPaidAmount - allocated;

        return {
          id: tx.id,
          tenantId: tx.tenantId,
          transactionCode: tx.transactionCode,
          beneficiaryId: tx.beneficiaryId,
          totalPaidAmount: tx.totalPaidAmount,
          paymentDocumentId: tx.paymentDocumentId,
          createdAt: tx.createdAt.toISOString(),
          updatedAt: tx.updatedAt.toISOString(),
          remainingBalance,
        };
      })
      .filter((tx) => tx.remainingBalance > 0); // Only return transactions with remaining balance
  }
}

@QueryHandler(ExportBankTransactionsQuery)
export class ExportBankTransactionsHandler
  implements IQueryHandler<ExportBankTransactionsQuery, { fileName: string; buffer: Buffer }>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ExportBankTransactionsQuery,
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === 'desc' ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.BankTransactionOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: direction } as Prisma.BankTransactionOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const transactions = await this.prisma.bankTransaction.findMany({
      where,
      orderBy,
      include: { allocations: true },
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transactions');
    sheet.columns = [
      { header: 'Transaction Code', key: 'transactionCode', width: 30 },
      { header: 'Beneficiary', key: 'beneficiaryId', width: 24 },
      { header: 'Total Paid', key: 'totalPaidAmount', width: 15 },
      { header: 'Allocated', key: 'allocated', width: 15 },
      { header: 'Remaining', key: 'remaining', width: 15 },
    ];
    transactions.forEach((tx) => {
      const allocated = tx.allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
      sheet.addRow({
        transactionCode: tx.transactionCode,
        beneficiaryId: tx.beneficiaryId,
        totalPaidAmount: tx.totalPaidAmount,
        allocated,
        remaining: tx.totalPaidAmount - allocated,
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: `transactions-${new Date().toISOString()}.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  private buildWhere(tenantId: string, filters: Record<string, string>) {
    const where: any = { tenantId };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value) return;
      switch (key) {
        case 'beneficiaryId':
          where[key] = value;
          break;
        case 'transactionCode':
          where[key] = { contains: value, mode: 'insensitive' };
          break;
        case 'fromDate':
        case 'toDate':
          where.createdAt = where.createdAt ?? {};
          if (key === 'fromDate') {
            where.createdAt.gte = new Date(String(value));
          } else {
            where.createdAt.lte = new Date(String(value));
          }
          break;
        default:
          break;
      }
    });
    return where;
  }
}

export const TransactionHandlers = [
  CreateBankTransactionHandler,
  ListBankTransactionsHandler,
  GetBankTransactionHandler,
  GetBankTransactionRemainingBalanceHandler,
  ListAvailableBankTransactionsHandler,
  ExportBankTransactionsHandler,
];
