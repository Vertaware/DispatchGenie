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
  DocumentType,
  InvoiceDto,
  InvoiceStatus,
  PaginatedResult,
  PaymentRequestStatus,
  PaymentRequestType,
} from '../../shared/enums/index';
import { DocumentManager, DocumentFilePayload } from '../../infrastructure/documents/document.manager';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';

type SortOrder = 'asc' | 'desc';

export class CreateInvoiceCommand {
  constructor(
    public readonly tenantId: string,
    public readonly invoiceNumber: string,
    public readonly date: string,
    public readonly vehicleIds: string[],
    public readonly overrideInvoiceAmount?: number,
    public readonly invoicePdf?: DocumentFilePayload | null,
  ) {}
}

export class ListInvoicesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
    public readonly filters: Record<string, string>,
  ) {}
}

export class GetInvoiceQuery {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}

export class MarkInvoicePaidCommand {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
    public readonly paidAmount: number,
    public readonly paidDate: string,
  ) {}
}

export class ExportInvoicesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters: Record<string, string>,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
  ) {}
}

@CommandHandler(CreateInvoiceCommand)
export class CreateInvoiceHandler implements ICommandHandler<CreateInvoiceCommand, InvoiceDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentManager: DocumentManager,
  ) {}

  async execute(command: CreateInvoiceCommand): Promise<InvoiceDto> {
    console.log(command);
    
    if (!command.vehicleIds || command.vehicleIds.length === 0) {
      throw new BadRequestException('At least one vehicle is required');
    }
    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId: command.tenantId, id: { in: command.vehicleIds } },
    });
    if (vehicles.length !== command.vehicleIds.length) {
      throw new BadRequestException('One or more vehicles not found');
    }
    const sumShippingAmount = vehicles.reduce((sum, v) => {
      const legacyVehicle = v as any;
      return sum + (v.vehicleAmount ?? legacyVehicle.shippingAmount ?? 0);
    }, 0);
    const totalProfit = vehicles.reduce((sum, v) => sum + (v.profit ?? 0), 0);
    const invoiceAmount = command.overrideInvoiceAmount ?? sumShippingAmount;

    let documentId: string | undefined;
    if (command.invoicePdf) {
      const document = await this.documentManager.createDocument(
        command.tenantId,
        DocumentType.INVOICE_PDF,
        command.invoicePdf,
      );
      documentId = document.id;
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          tenantId: command.tenantId,
          invoiceNumber: command.invoiceNumber,
          date: new Date(command.date),
          invoiceAmount,
          status: InvoiceStatus.DRAFT,
          invoiceDocumentId: documentId ?? null,
          totalProfit,
        },
      });
      await tx.invoiceVehicle.createMany({
        data: command.vehicleIds.map((vehicleId) => ({
          tenantId: command.tenantId,
          invoiceId: created.id,
          vehicleId,
        })),
      });
      await tx.vehicle.updateMany({
        where: { tenantId: command.tenantId, id: { in: command.vehicleIds } },
        data: { invoiceStatus: 'INVOICE_CREATED' },
      });
      return created;
    });

    return this.map(invoice);
  }

  private map(invoice: any): InvoiceDto {
    return {
      id: invoice.id,
      tenantId: invoice.tenantId,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date.toISOString(),
      invoiceAmount: invoice.invoiceAmount,
      status: invoice.status as InvoiceStatus,
      paidDate: invoice.paidDate?.toISOString() ?? null,
      paidAmount: invoice.paidAmount ?? null,
      invoiceDocumentId: invoice.invoiceDocumentId ?? null,
      totalProfit: invoice.totalProfit ?? null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      // New fields set to null for create/update operations (not used in listing)
      vehicleNumber: null,
      driverPhone: null,
      vehicleAmount: null,
      locationReachedAt: null,
      unloadedDate: null,
      dbWaitingTime: null,
      frightCost: null,
      unloadingCharge: null,
      detentionCharge: null,
      otherExpense: null,
      totalExpense: null,
      profit: null,
    };
  }
}

@QueryHandler(ListInvoicesQuery)
export class ListInvoicesHandler
  implements IQueryHandler<ListInvoicesQuery, PaginatedResult<InvoiceDto>>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListInvoicesQuery): Promise<PaginatedResult<InvoiceDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === 'desc' ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.InvoiceOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: direction } as Prisma.InvoiceOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const [totalCount, invoices] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          vehicles: {
            include: {
              vehicle: {
                include: {
                  salesOrders: {
                    include: {
                      salesOrder: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    return {
      data: await Promise.all(invoices.map((invoice) => this.map(invoice, query.tenantId))),
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
        case 'status':
          where.status = value.includes(',') ? { in: value.split(',') } : value;
          break;
        case 'invoiceNumber':
          where.invoiceNumber = { contains: value, mode: 'insensitive' };
          break;
        case 'fromDate':
        case 'toDate':
          where.date = where.date ?? {};
          if (key === 'fromDate') where.date.gte = new Date(value);
          else where.date.lte = new Date(value);
          break;
        default:
          break;
      }
    });
    return where;
  }

  private async map(invoice: any, tenantId: string): Promise<InvoiceDto> {
    const vehicles = invoice.vehicles || [];
    const firstVehicle = vehicles[0]?.vehicle;
    
    // Aggregate vehicle data
    const vehicleNumber = firstVehicle?.vehicleNumber ?? null;
    const driverPhone = firstVehicle?.driverPhoneNumber ?? null;
    const vehicleAmount = vehicles.reduce((sum: number, iv: any) => {
      const v = iv.vehicle;
      return sum + (v?.vehicleAmount ?? 0);
    }, 0);
    const locationReachedAt = firstVehicle?.locationReachedAt?.toISOString() ?? null;
    const unloadedDate = firstVehicle?.unloadedTime?.toISOString() ?? null;
    const dbWaitingTime = firstVehicle?.dbWaitingTimeHours ?? null;

    // Collect all sales order IDs from vehicles
    const salesOrderIds = new Set<string>();
    vehicles.forEach((iv: any) => {
      const vehicle = iv.vehicle;
      if (vehicle?.salesOrders) {
        vehicle.salesOrders.forEach((vso: any) => {
          if (vso?.salesOrder?.id) {
            salesOrderIds.add(vso.salesOrder.id);
          }
        });
      }
    });

    // Aggregate sales order data
    let frightCost = 0;
    if (salesOrderIds.size > 0) {
      const salesOrders = await this.prisma.salesOrder.findMany({
        where: {
          id: { in: Array.from(salesOrderIds) },
          tenantId,
        },
      });
      frightCost = salesOrders.reduce((sum, so) => sum + (so.frightCost ?? 0), 0);
    }

    // Calculate charges from payment requests
    let unloadingCharge = 0;
    let detentionCharge = 0;
    let miscellaneousCharges = 0;
    if (salesOrderIds.size > 0) {
      const vehicleIds = vehicles.map((iv: any) => iv.vehicleId);
      const paymentRequests = await this.prisma.paymentRequest.findMany({
        where: {
          tenantId,
          vehicleId: { in: vehicleIds },
          salesOrderId: { in: Array.from(salesOrderIds) },
          status: PaymentRequestStatus.COMPLETED,
          transactionType: {
            in: [
              PaymentRequestType.UNLOADING_CHARGE,
              PaymentRequestType.UNLOADING_DETENTION,
              PaymentRequestType.MISCELLANEOUS_CHARGES,
            ],
          },
        },
      });
      unloadingCharge = paymentRequests
        .filter((pr) => pr.transactionType === PaymentRequestType.UNLOADING_CHARGE)
        .reduce((sum, pr) => sum + pr.requestedAmount, 0);
      detentionCharge = paymentRequests
        .filter((pr) => pr.transactionType === PaymentRequestType.UNLOADING_DETENTION)
        .reduce((sum, pr) => sum + pr.requestedAmount, 0);
      miscellaneousCharges = paymentRequests
        .filter((pr) => pr.transactionType === PaymentRequestType.MISCELLANEOUS_CHARGES)
        .reduce((sum, pr) => sum + pr.requestedAmount, 0);
    }

    // Calculate total expense: Vehicle amount + Unloading charge + Detention charge + Miscellaneous charge
    const totalExpense = vehicleAmount + unloadingCharge + detentionCharge + miscellaneousCharges;

    // Calculate profit: Fright cost - Total expense
    const profit = frightCost - totalExpense;

    // Other expense is the miscellaneous charges (for display purposes)
    const otherExpense = miscellaneousCharges;

    return {
      id: invoice.id,
      tenantId: invoice.tenantId,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date.toISOString(),
      invoiceAmount: invoice.invoiceAmount,
      status: invoice.status as InvoiceStatus,
      paidDate: invoice.paidDate?.toISOString() ?? null,
      paidAmount: invoice.paidAmount ?? null,
      invoiceDocumentId: invoice.invoiceDocumentId ?? null,
      totalProfit: invoice.totalProfit ?? null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      vehicleNumber,
      driverPhone,
      vehicleAmount: vehicleAmount > 0 ? vehicleAmount : null,
      locationReachedAt,
      unloadedDate,
      dbWaitingTime,
      frightCost: frightCost > 0 ? frightCost : null,
      unloadingCharge: unloadingCharge > 0 ? unloadingCharge : null,
      detentionCharge: detentionCharge > 0 ? detentionCharge : null,
      otherExpense: otherExpense > 0 ? otherExpense : null,
      totalExpense: totalExpense > 0 ? totalExpense : null,
      profit: profit ?? null,
    };
  }
}

@QueryHandler(GetInvoiceQuery)
export class GetInvoiceHandler implements IQueryHandler<GetInvoiceQuery, any> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetInvoiceQuery): Promise<any> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
      include: {
        vehicles: {
          include: { vehicle: true },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }
}

@CommandHandler(MarkInvoicePaidCommand)
export class MarkInvoicePaidHandler
  implements ICommandHandler<MarkInvoicePaidCommand, InvoiceDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: MarkInvoicePaidCommand): Promise<InvoiceDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: command.id, tenantId: command.tenantId },
      include: { vehicles: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: command.paidAmount,
          paidDate: new Date(command.paidDate),
        },
      });
      await tx.vehicle.updateMany({
        where: { tenantId: command.tenantId, id: { in: invoice.vehicles.map((v) => v.vehicleId) } },
        data: { invoiceStatus: 'INVOICE_PAID' },
      });
      return updatedInvoice;
    });
    return this.map(updated);
  }

  private map(invoice: any): InvoiceDto {
    return {
      id: invoice.id,
      tenantId: invoice.tenantId,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date.toISOString(),
      invoiceAmount: invoice.invoiceAmount,
      status: invoice.status as InvoiceStatus,
      paidDate: invoice.paidDate?.toISOString() ?? null,
      paidAmount: invoice.paidAmount ?? null,
      invoiceDocumentId: invoice.invoiceDocumentId ?? null,
      totalProfit: invoice.totalProfit ?? null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(ExportInvoicesQuery)
export class ExportInvoicesHandler
  implements IQueryHandler<ExportInvoicesQuery, { fileName: string; buffer: Buffer }>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ExportInvoicesQuery,
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === 'desc' ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.InvoiceOrderByWithRelationInput = query.sortBy
      ? ({ [query.sortBy]: direction } as Prisma.InvoiceOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy,
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Invoices');
    sheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 25 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Amount', key: 'invoiceAmount', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Paid Amount', key: 'paidAmount', width: 15 },
    ];
    invoices.forEach((invoice) => {
      sheet.addRow({
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date.toISOString(),
        invoiceAmount: invoice.invoiceAmount,
        status: invoice.status,
        paidAmount: invoice.paidAmount ?? '',
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: `invoices-${new Date().toISOString()}.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  private buildWhere(tenantId: string, filters: Record<string, string>) {
    const where: any = { tenantId };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value) return;
      switch (key) {
        case 'status':
          where.status = value.includes(',') ? { in: value.split(',') } : value;
          break;
        case 'invoiceNumber':
          where.invoiceNumber = { contains: value, mode: 'insensitive' };
          break;
        case 'fromDate':
        case 'toDate':
          where.date = where.date ?? {};
          if (key === 'fromDate') where.date.gte = new Date(value);
          else where.date.lte = new Date(value);
          break;
        default:
          break;
      }
    });
    return where;
  }
}

export const InvoiceHandlers = [
  CreateInvoiceHandler,
  ListInvoicesHandler,
  GetInvoiceHandler,
  MarkInvoicePaidHandler,
  ExportInvoicesHandler,
];
