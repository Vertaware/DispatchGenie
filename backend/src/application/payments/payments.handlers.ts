import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from "@nestjs/cqrs";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { Prisma } from "@prisma/client";
import {
  BankTransactionDto,
  DocumentType,
  PaginatedResult,
  PaymentAllocationDto,
  PaymentRequestDto,
  PaymentRequestStatus,
  PaymentRequestType,
  VehicleStatus,
} from "../../shared/enums/index";
import ExcelJS from "exceljs";

type SortOrder = "asc" | "desc";

export class CreatePaymentRequestCommand {
  constructor(
    public readonly tenantId: string,
    public readonly salesOrderId: string,
    public readonly vehicleId: string,
    public readonly transactionType: PaymentRequestType,
    public readonly requestedAmount: number,
    public readonly beneficiaryId?: string,
    public readonly notes?: string,
    public readonly locationReachedAt?: string,
    public readonly unloadedTime?: string
  ) {}
}

export class ListPaymentRequestsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
    public readonly filters: Record<string, string>
  ) {}
}

export class GetPaymentRequestQuery {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}


export class CompletePaymentRequestLinkTransactionCommand {
  constructor(
    public readonly tenantId: string,
    public readonly paymentRequestId: string,
    public readonly transactionIds: string[]
  ) {}
}

export interface TransactionAllocation {
  bankTransactionId: string;
  allocatedAmount: number;
}

export class CompletePaymentRequestsWithTransactionsCommand {
  constructor(
    public readonly tenantId: string,
    public readonly paymentRequestIds: string[],
    public readonly allocations: TransactionAllocation[]
  ) {}
}

export class ExportPaymentRequestsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters: Record<string, string>,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined
  ) {}
}

export class UpdatePaymentRequestBeneficiaryCommand {
  constructor(
    public readonly tenantId: string,
    public readonly paymentRequestId: string,
    public readonly beneficiaryId: string
  ) {}
}

export class GetEligibleTransactionsForPaymentQuery {
  constructor(
    public readonly tenantId: string,
    public readonly paymentRequestId: string
  ) {}
}

export interface TransactionAllocationInput {
  bankTransactionId: string;
  allocatedAmount: number;
}

export class LinkTransactionsToPaymentCommand {
  constructor(
    public readonly tenantId: string,
    public readonly paymentRequestId: string,
    public readonly allocations: TransactionAllocationInput[]
  ) {}
}

interface PaymentRequestDetail {
  paymentRequest: PaymentRequestDto;
  allocations: PaymentAllocationDto[];
  vehicle: any;
  salesOrder: any;
  bankTransactions: any[];
}

@CommandHandler(CreatePaymentRequestCommand)
export class CreatePaymentRequestHandler
  implements ICommandHandler<CreatePaymentRequestCommand, PaymentRequestDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: CreatePaymentRequestCommand
  ): Promise<PaymentRequestDto> {
    const {
      tenantId,
      salesOrderId,
      vehicleId,
      transactionType,
      requestedAmount,
      beneficiaryId,
      notes,
      locationReachedAt,
      unloadedTime,
    } = command;

    const link = await this.prisma.vehicleSalesOrder.findFirst({
      where: { tenantId, vehicleId, salesOrderId },
    });
    if (!link) {
      throw new BadRequestException("Sales order not linked to vehicle");
    }
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    const legacyVehicle = vehicle as any;
    const vehicleAmount =
      vehicle.vehicleAmount ?? legacyVehicle.shippingAmount ?? 0;

    if (
      transactionType === PaymentRequestType.MISCELLANEOUS_CHARGES &&
      (!notes || !notes.trim())
    ) {
      throw new BadRequestException(
        "Notes are required for Miscellaneous Charges"
      );
    }

    // Balance/Full Shipping require POD to be uploaded before creating payment request
    if (
      transactionType === PaymentRequestType.BALANCE_SHIPPING ||
      transactionType === PaymentRequestType.FULL_SHIPPING_CHARGES
    ) {
      const pod = await this.prisma.vehicleDocument.findFirst({
        where: {
          tenantId,
          vehicleId,
          document: { type: DocumentType.POD },
        },
      });
      if (!pod) {
        throw new ForbiddenException(
          "Balance Shipping and Full Shipping Charges require POD document"
        );
      }
    }

    // Payment type specific validations
    if (
      transactionType === PaymentRequestType.ADVANCE_SHIPPING ||
      transactionType === PaymentRequestType.BALANCE_SHIPPING ||
      transactionType === PaymentRequestType.FULL_SHIPPING_CHARGES
    ) {
      // For Advance Shipping: amount must be <= VehicleAmount - 1
      if (transactionType === PaymentRequestType.ADVANCE_SHIPPING) {
        if (requestedAmount >= vehicleAmount) {
          throw new BadRequestException(
            `Advance Shipping amount must be strictly less than Vehicle Amount (max: ${
              vehicleAmount - 1
            })`
          );
        }
      }

      // For Balance/Full Shipping: check total doesn't exceed vehicle amount
      const existingRequests = await this.prisma.paymentRequest.findMany({
        where: {
          tenantId,
          vehicleId,
          transactionType: {
            in: [
              PaymentRequestType.ADVANCE_SHIPPING as any,
              PaymentRequestType.BALANCE_SHIPPING as any,
              PaymentRequestType.FULL_SHIPPING_CHARGES as any,
            ],
          },
        },
      });
      const totalRequested =
        existingRequests.reduce((sum, req) => sum + req.requestedAmount, 0) +
        requestedAmount;
      if (totalRequested > vehicleAmount) {
        throw new BadRequestException("Total requested exceeds vehicle amount");
      }
    } else if (transactionType === PaymentRequestType.UNLOADING_CHARGE) {
      // For Unloading Charge: validate against LoadingQuantity * 3
      const loadingQuantity = vehicle.loadingQuantity ?? 0;
      const maxUnloadingAmount = loadingQuantity * 3;
      if (requestedAmount > maxUnloadingAmount) {
        throw new BadRequestException(
          `Unloading Charge cannot exceed Loading Quantity * 3 (max: ${maxUnloadingAmount})`
        );
      }
    } else if (transactionType === PaymentRequestType.UNLOADING_DETENTION) {
      // For UNLOADING_DETENTION: validate required fields
      if (!locationReachedAt) {
        throw new BadRequestException(
          "locationReachedAt is required for UNLOADING_DETENTION payment requests"
        );
      }
      if (!unloadedTime) {
        throw new BadRequestException(
          "unloadedTime is required for UNLOADING_DETENTION payment requests"
        );
      }

      // Validate that unloadedTime is after locationReachedAt
      const locationReachedDate = new Date(locationReachedAt);
      const unloadedDate = new Date(unloadedTime);
      if (unloadedDate < locationReachedDate) {
        throw new BadRequestException(
          "unloadedTime must be after locationReachedAt"
        );
      }
    }

    // Update vehicle for UNLOADING_DETENTION before creating payment request
    if (transactionType === PaymentRequestType.UNLOADING_DETENTION && locationReachedAt && unloadedTime) {
      const locationReachedDate = new Date(locationReachedAt);
      const unloadedDate = new Date(unloadedTime);
      
      // Calculate dbWaitingTimeHours: difference in hours
      const diffMs = unloadedDate.getTime() - locationReachedDate.getTime();
      const dbWaitingTimeHours = diffMs / (1000 * 60 * 60); // Convert milliseconds to hours

      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          locationReachedAt: locationReachedDate,
          unloadedTime: unloadedDate,
          dbWaitingTimeHours,
        },
      });
    }

    const createData: Prisma.PaymentRequestCreateInput = {
      tenantId,
      salesOrderId,
      vehicleId,
      transactionType: transactionType as any,
      requestedAmount,
      beneficiaryId: beneficiaryId ?? "",
      status: PaymentRequestStatus.PENDING,
      hasUnloadingCharge: transactionType === PaymentRequestType.UNLOADING_CHARGE,
      notes: notes?.trim() ?? null,
    } as any;

    const paymentRequest = await this.prisma.paymentRequest.create({
      data: createData,
      include: {
        salesOrder: true,
      },
    });
    return this.map(paymentRequest);
  }

  private map(request: any): PaymentRequestDto {
    return {
      id: request.id,
      tenantId: request.tenantId,
      salesOrderId: request.salesOrderId,
      soNumber: request.salesOrder?.soNumber,
      vehicleId: request.vehicleId,
      transactionType: request.transactionType as PaymentRequestType,
      paymentDate: request.paymentDate ? request.paymentDate.toISOString() : null,
      requestedAmount: request.requestedAmount,
      beneficiaryId: request.beneficiaryId,
      status: request.status as PaymentRequestStatus,
      hasUnloadingCharge: !!request.hasUnloadingCharge,
      notes: request.notes ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(ListPaymentRequestsQuery)
export class ListPaymentRequestsHandler
  implements
    IQueryHandler<ListPaymentRequestsQuery, PaginatedResult<PaymentRequestDto>>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ListPaymentRequestsQuery
  ): Promise<PaginatedResult<PaymentRequestDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === "desc" ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.PaymentRequestOrderByWithRelationInput = query.sortBy
      ? ({
          [query.sortBy]: direction,
        } as Prisma.PaymentRequestOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const [totalCount, requests] = await this.prisma.$transaction([
      this.prisma.paymentRequest.count({ where }),
      this.prisma.paymentRequest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          salesOrder: true,
        },
      }),
    ]);
    return {
      data: requests.map((req) => this.map(req)),
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
        case "status":
        case "transactionType":
          where[key] = value.includes(",") ? { in: value.split(",") } : value;
          break;
        case "vehicleId":
        case "salesOrderId":
        case "beneficiaryId":
          where[key] = value;
          break;
        case "fromDate":
        case "toDate":
          where.createdAt = where.createdAt ?? {};
          if (key === "fromDate") {
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

  private map(request: any): PaymentRequestDto {
    return {
      id: request.id,
      tenantId: request.tenantId,
      salesOrderId: request.salesOrderId,
      soNumber: request.salesOrder?.soNumber,
      vehicleId: request.vehicleId,
      transactionType: request.transactionType,
      paymentDate: request.paymentDate ? request.paymentDate.toISOString() : null,
      requestedAmount: request.requestedAmount,
      beneficiaryId: request.beneficiaryId,
      status: request.status,
      hasUnloadingCharge: !!request.hasUnloadingCharge,
      notes: request.notes ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(GetPaymentRequestQuery)
export class GetPaymentRequestHandler
  implements IQueryHandler<GetPaymentRequestQuery, PaymentRequestDetail>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetPaymentRequestQuery): Promise<PaymentRequestDetail> {
    const paymentRequest = await this.prisma.paymentRequest.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
      include: {
        allocations: true,
        vehicle: true,
        salesOrder: true,
      },
    });
    if (!paymentRequest) {
      throw new NotFoundException("Payment request not found");
    }
    const bankTransactions = await this.prisma.bankTransaction.findMany({
      where: {
        tenantId: query.tenantId,
        allocations: { some: { paymentRequestId: paymentRequest.id } },
      },
    });
    return {
      paymentRequest: this.map(paymentRequest),
      allocations: paymentRequest.allocations.map((a) => this.mapAllocation(a)),
      vehicle: paymentRequest.vehicle,
      salesOrder: paymentRequest.salesOrder,
      bankTransactions,
    };
  }

  private map(request: any): PaymentRequestDto {
    return {
      id: request.id,
      tenantId: request.tenantId,
      salesOrderId: request.salesOrderId,
      vehicleId: request.vehicleId,
      transactionType: request.transactionType,
      paymentDate: request.paymentDate ? request.paymentDate.toISOString() : null,
      requestedAmount: request.requestedAmount,
      beneficiaryId: request.beneficiaryId,
      status: request.status,
      hasUnloadingCharge: !!request.hasUnloadingCharge,
      notes: request.notes ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private mapAllocation(allocation: any): PaymentAllocationDto {
    return {
      id: allocation.id,
      tenantId: allocation.tenantId,
      paymentRequestId: allocation.paymentRequestId,
      bankTransactionId: allocation.bankTransactionId,
      allocatedAmount: allocation.allocatedAmount,
      createdAt: allocation.createdAt.toISOString(),
    };
  }
}


@CommandHandler(CompletePaymentRequestLinkTransactionCommand)
export class CompletePaymentRequestLinkTransactionHandler
  implements
    ICommandHandler<
      CompletePaymentRequestLinkTransactionCommand,
      PaymentRequestDto
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: CompletePaymentRequestLinkTransactionCommand
  ): Promise<PaymentRequestDto> {
    const { tenantId, paymentRequestId, transactionIds } = command;
    
    if (!transactionIds || transactionIds.length === 0) {
      throw new BadRequestException("At least one transaction ID is required");
    }

    const paymentRequest = await this.prisma.paymentRequest.findFirst({
      where: { id: paymentRequestId, tenantId },
      include: { allocations: true },
    });
    if (!paymentRequest) {
      throw new NotFoundException("Payment request not found");
    }
    if (paymentRequest.status === PaymentRequestStatus.COMPLETED) {
      throw new ConflictException("Payment request already completed");
    }

    // Fetch all transactions
    const transactions = await this.prisma.bankTransaction.findMany({
      where: { 
        id: { in: transactionIds },
        tenantId 
      },
      include: { allocations: true },
    });

    if (transactions.length !== transactionIds.length) {
      throw new NotFoundException("One or more transactions not found");
    }

    // Validate beneficiary matches
    for (const tx of transactions) {
      if (tx.beneficiaryId !== paymentRequest.beneficiaryId) {
        throw new BadRequestException("Transaction beneficiary mismatch");
      }
    }

    // Calculate remaining balances for each transaction
    const transactionData = transactions.map((tx) => {
      const allocated = tx.allocations.reduce(
        (sum, alloc) => sum + alloc.allocatedAmount,
        0
      );
      const remainingBalance = tx.totalPaidAmount - allocated;
      return {
        transaction: tx,
        remainingBalance,
        amountApplied: allocated,
      };
    });

    // Validation rules
    const paymentAmount = paymentRequest.requestedAmount;
    const alreadyAllocated = paymentRequest.allocations.reduce(
      (sum, alloc) => sum + alloc.allocatedAmount,
      0
    );
    const remainingPaymentAmount = paymentAmount - alreadyAllocated;
    const transactionAmounts = transactionData.map((td) => td.remainingBalance);
    const totalLinkedAmount = transactionAmounts.reduce((sum, amt) => sum + amt, 0);

    if (transactionIds.length > 1) {
      // Multiple transactions: no single transaction can exceed remaining payment amount, and sum must not exceed remaining payment amount
      for (const td of transactionData) {
        if (td.remainingBalance > remainingPaymentAmount) {
          throw new BadRequestException(
            `Transaction ${td.transaction.transactionCode} has amount ${td.remainingBalance} which exceeds remaining payment request amount ${remainingPaymentAmount}. When linking multiple transactions, no single transaction can exceed the remaining payment amount.`
          );
        }
      }
      if (totalLinkedAmount > remainingPaymentAmount) {
        throw new BadRequestException(
          `Total linked amount (${totalLinkedAmount}) exceeds remaining payment request amount (${remainingPaymentAmount})`
        );
      }
    } else {
      // Single transaction: allowed even if it exceeds remaining payment amount
      // No additional validation needed beyond what's already checked
    }

    // Verify all transactions have sufficient remaining balance
    for (const td of transactionData) {
      if (td.remainingBalance <= 0) {
        throw new BadRequestException(
          `Transaction ${td.transaction.transactionCode} has no remaining balance`
        );
      }
    }

    // Calculate allocation amounts (use full remaining balance of each transaction)
    // alreadyAllocated and remainingPaymentAmount are already calculated above
    
    // Allocate full remaining balance of each transaction
    // Validation ensures totalLinkedAmount <= paymentAmount (accounting for alreadyAllocated)
    const allocations: Array<{ bankTransactionId: string; allocatedAmount: number }> = [];
    let remainingToAllocate = remainingPaymentAmount;
    
    for (const td of transactionData) {
      if (remainingToAllocate <= 0) break;
      // Use full remaining balance, but don't exceed remaining payment amount
      const allocationAmount = Math.min(td.remainingBalance, remainingToAllocate);
      allocations.push({
        bankTransactionId: td.transaction.id,
        allocatedAmount: allocationAmount,
      });
      remainingToAllocate -= allocationAmount;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Create allocations
      for (const allocation of allocations) {
        await tx.paymentAllocation.create({
          data: {
            tenantId,
            paymentRequestId,
            bankTransactionId: allocation.bankTransactionId,
            allocatedAmount: allocation.allocatedAmount,
          },
        });
      }

      // Check if payment request is now fully allocated
      const updatedRequest = await tx.paymentRequest.findFirst({
        where: { id: paymentRequestId },
        include: { allocations: true },
      });
      
      if (updatedRequest) {
        const totalAllocated = updatedRequest.allocations.reduce(
          (sum, alloc) => sum + alloc.allocatedAmount,
          0
        );
        
        if (totalAllocated >= paymentAmount) {
          // Find the latest transaction date for payment date
          const latestTransaction = transactions.reduce((latest, tx) => {
            if (!latest || !tx.transactionDate) return tx;
            if (!latest.transactionDate) return tx;
            return tx.transactionDate > latest.transactionDate ? tx : latest;
          }, transactions[0]);
          
          await tx.paymentRequest.update({
            where: { id: paymentRequestId },
            data: {
              status: PaymentRequestStatus.COMPLETED,
              paymentDate: latestTransaction?.transactionDate ?? new Date(),
            },
          });
          await this.ensureVehiclePaymentPolicy(
            tx,
            tenantId,
            paymentRequest.vehicleId
          );
        }
        
        return updatedRequest;
      }
      
      return paymentRequest;
    });
    
    return this.map(updated);
  }

  private map(request: any): PaymentRequestDto {
    return {
      id: request.id,
      tenantId: request.tenantId,
      salesOrderId: request.salesOrderId,
      vehicleId: request.vehicleId,
      transactionType: request.transactionType,
      paymentDate: request.paymentDate ? request.paymentDate.toISOString() : null,
      requestedAmount: request.requestedAmount,
      beneficiaryId: request.beneficiaryId,
      status: request.status,
      hasUnloadingCharge: !!request.hasUnloadingCharge,
      notes: request.notes ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private async ensureVehiclePaymentPolicy(
    tx: Prisma.TransactionClient,
    tenantId: string,
    vehicleId: string
  ) {
    const vehicle = await tx.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });
    if (!vehicle) return;
    const allocations = await tx.paymentRequest.findMany({
      where: {
        tenantId,
        vehicleId,
        transactionType: {
          in: [
            PaymentRequestType.BALANCE_SHIPPING as any,
            PaymentRequestType.FULL_SHIPPING_CHARGES as any,
          ],
        },
        status: PaymentRequestStatus.COMPLETED,
      },
    });
    // If Balance or Full Shipping completed, auto-complete vehicle
    if (allocations.length > 0) {
      const pod = await tx.vehicleDocument.findFirst({
        where: {
          tenantId,
          vehicleId,
          document: { type: DocumentType.POD },
        },
        include: { document: true },
      });
      if (pod) {
        // Auto-complete vehicle and sync SO statuses
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: VehicleStatus.COMPLETED },
        });
        const { syncSalesOrderStatusFromVehicle } = await import(
          "../../domain/common/status.rules"
        );
        await syncSalesOrderStatusFromVehicle(
          tx,
          tenantId,
          vehicleId,
          VehicleStatus.COMPLETED
        );
      }
    }
  }
}

@QueryHandler(ExportPaymentRequestsQuery)
export class ExportPaymentRequestsHandler
  implements
    IQueryHandler<
      ExportPaymentRequestsQuery,
      { fileName: string; buffer: Buffer }
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ExportPaymentRequestsQuery
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === "desc" ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.PaymentRequestOrderByWithRelationInput = query.sortBy
      ? ({
          [query.sortBy]: direction,
        } as Prisma.PaymentRequestOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const requests = await this.prisma.paymentRequest.findMany({
      where,
      orderBy,
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Payment Requests");
    sheet.columns = [
      { header: "Sales Order", key: "salesOrderId", width: 24 },
      { header: "Vehicle", key: "vehicleId", width: 24 },
      { header: "Type", key: "transactionType", width: 15 },
      { header: "Requested Amount", key: "requestedAmount", width: 20 },
      { header: "Beneficiary", key: "beneficiaryId", width: 24 },
      { header: "Status", key: "status", width: 15 },
    ];
    requests.forEach((req) => {
      sheet.addRow({
        salesOrderId: req.salesOrderId,
        vehicleId: req.vehicleId,
        transactionType: req.transactionType,
        requestedAmount: req.requestedAmount,
        beneficiaryId: req.beneficiaryId,
        status: req.status,
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: `payment-requests-${new Date().toISOString()}.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  private buildWhere(tenantId: string, filters: Record<string, string>) {
    const where: any = { tenantId };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value) return;
      switch (key) {
        case "status":
        case "transactionType":
          where[key] = value.includes(",") ? { in: value.split(",") } : value;
          break;
        case "vehicleId":
        case "salesOrderId":
        case "beneficiaryId":
          where[key] = value;
          break;
        case "fromDate":
        case "toDate":
          where.createdAt = where.createdAt ?? {};
          if (key === "fromDate") {
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

@CommandHandler(CompletePaymentRequestsWithTransactionsCommand)
export class CompletePaymentRequestsWithTransactionsHandler
  implements
    ICommandHandler<
      CompletePaymentRequestsWithTransactionsCommand,
      { paymentRequests: PaymentRequestDto[] }
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: CompletePaymentRequestsWithTransactionsCommand
  ): Promise<{ paymentRequests: PaymentRequestDto[] }> {
    const { tenantId, paymentRequestIds, allocations } = command;

    if (!paymentRequestIds || paymentRequestIds.length === 0) {
      throw new BadRequestException("At least one payment request is required");
    }

    if (!allocations || allocations.length === 0) {
      throw new BadRequestException(
        "At least one transaction allocation is required"
      );
    }

    // Fetch all payment requests
    const paymentRequests = await this.prisma.paymentRequest.findMany({
      where: { tenantId, id: { in: paymentRequestIds } },
    });

    if (paymentRequests.length !== paymentRequestIds.length) {
      throw new NotFoundException("One or more payment requests not found");
    }

    // Check all are pending
    const completedRequests = paymentRequests.filter(
      (req) => req.status === PaymentRequestStatus.COMPLETED
    );
    if (completedRequests.length > 0) {
      throw new ConflictException(
        "One or more payment requests already completed"
      );
    }

    // Verify all have same beneficiary
    const beneficiaryIds = [
      ...new Set(paymentRequests.map((req) => req.beneficiaryId)),
    ];
    if (beneficiaryIds.length > 1) {
      throw new BadRequestException(
        "All payment requests must have the same beneficiary"
      );
    }

    // Fetch all transactions
    const transactionIds = allocations.map((a) => a.bankTransactionId);
    const transactions = await this.prisma.bankTransaction.findMany({
      where: { tenantId, id: { in: transactionIds } },
      include: { allocations: true },
    });

    if (transactions.length !== transactionIds.length) {
      throw new NotFoundException("One or more transactions not found");
    }

    // Verify beneficiary matches
    for (const tx of transactions) {
      if (tx.beneficiaryId !== beneficiaryIds[0]) {
        throw new BadRequestException("Transaction beneficiary mismatch");
      }
    }

    // Calculate total requested and total allocated
    const totalRequested = paymentRequests.reduce(
      (sum, req) => sum + req.requestedAmount,
      0
    );
    const totalAllocated = allocations.reduce(
      (sum, a) => sum + a.allocatedAmount,
      0
    );

    if (totalAllocated !== totalRequested) {
      throw new BadRequestException(
        `Total allocated amount (${totalAllocated}) must equal total requested amount (${totalRequested})`
      );
    }

    // Verify transaction balances
    for (const allocation of allocations) {
      const tx = transactions.find(
        (t) => t.id === allocation.bankTransactionId
      );
      if (!tx) continue;

      const currentAllocated = tx.allocations.reduce(
        (sum, alloc) => sum + alloc.allocatedAmount,
        0
      );
      const newAllocated = allocations
        .filter((a) => a.bankTransactionId === allocation.bankTransactionId)
        .reduce((sum, a) => sum + a.allocatedAmount, 0);

      if (currentAllocated + newAllocated > tx.totalPaidAmount) {
        throw new BadRequestException(
          `Transaction ${tx.transactionCode}: allocated amount exceeds remaining balance`
        );
      }
    }

    // Check POD requirements
    await this.ensurePodPreCheck(tenantId, paymentRequests);

    // Create allocations and update payment requests
    const result = await this.prisma.$transaction(async (tx) => {
      const requestPaymentDates = new Map<string, Date>();
      // Create allocations
      for (const allocation of allocations) {
        // Find payment requests that should be linked to this transaction
        // For simplicity, distribute proportionally or use first-fit
        // In a real scenario, you might want more sophisticated allocation logic
        const linkedRequestIds = paymentRequestIds.filter((reqId) => {
          const req = paymentRequests.find((r) => r.id === reqId);
          return (
            req &&
            req.beneficiaryId ===
              transactions.find((t) => t.id === allocation.bankTransactionId)
                ?.beneficiaryId
          );
        });

        // For now, allocate to first matching request
        // In production, you'd want more sophisticated allocation
        if (linkedRequestIds.length > 0) {
          const targetRequestId = linkedRequestIds[0];
          await tx.paymentAllocation.create({
            data: {
              tenantId,
              paymentRequestId: targetRequestId,
              bankTransactionId: allocation.bankTransactionId,
              allocatedAmount: allocation.allocatedAmount,
            },
          });
          const allocationTx = transactions.find(
            (t) => t.id === allocation.bankTransactionId
          );
          if (allocationTx) {
            const existingDate = requestPaymentDates.get(targetRequestId);
            const txDate = allocationTx.transactionDate;
            if (!existingDate || txDate > existingDate) {
              requestPaymentDates.set(targetRequestId, txDate);
            }
          }
        }
      }

      // Update all payment requests to completed
      const updatedRequests: PaymentRequestDto[] = [];
      for (const req of paymentRequests) {
        const paymentDate =
          requestPaymentDates.get(req.id) ??
          transactions[0]?.transactionDate ??
          new Date();
        const updated = await tx.paymentRequest.update({
          where: { id: req.id },
          data: {
            status: PaymentRequestStatus.COMPLETED,
            paymentDate,
          },
        });
        await this.ensureVehiclePaymentPolicy(tx, tenantId, req.vehicleId);
        updatedRequests.push(this.map(updated));
      }

      return { paymentRequests: updatedRequests };
    });

    return result;
  }

  private map(request: any): PaymentRequestDto {
    return {
      id: request.id,
      tenantId: request.tenantId,
      salesOrderId: request.salesOrderId,
      vehicleId: request.vehicleId,
      transactionType: request.transactionType,
      paymentDate: request.paymentDate ? request.paymentDate.toISOString() : null,
      requestedAmount: request.requestedAmount,
      beneficiaryId: request.beneficiaryId,
      status: request.status,
      hasUnloadingCharge: !!request.hasUnloadingCharge,
      notes: request.notes ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private async ensurePodPreCheck(tenantId: string, requests: any[]) {
    const relevantRequests = requests.filter((req) =>
      [
        PaymentRequestType.BALANCE_SHIPPING as any,
        PaymentRequestType.FULL_SHIPPING_CHARGES as any,
      ].includes(req.transactionType)
    );
    if (relevantRequests.length === 0) {
      return;
    }
    for (const req of relevantRequests) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: req.vehicleId, tenantId },
      });
      if (!vehicle) continue;
      const pod = await this.prisma.vehicleDocument.findFirst({
        where: {
          tenantId,
          vehicleId: req.vehicleId,
          document: { type: DocumentType.POD },
        },
      });
      if (!pod) {
        throw new ForbiddenException(
          "Balance Shipping and Full Shipping Charges require POD document"
        );
      }
    }
  }

  private async ensureVehiclePaymentPolicy(
    tx: Prisma.TransactionClient,
    tenantId: string,
    vehicleId: string
  ) {
    const vehicle = await tx.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });
    if (!vehicle) return;
    const allocations = await tx.paymentRequest.findMany({
      where: {
        tenantId,
        vehicleId,
        transactionType: {
          in: [
            PaymentRequestType.BALANCE_SHIPPING as any,
            PaymentRequestType.FULL_SHIPPING_CHARGES as any,
          ],
        },
        status: PaymentRequestStatus.COMPLETED,
      },
    });
    if (allocations.length > 0) {
      const pod = await tx.vehicleDocument.findFirst({
        where: {
          tenantId,
          vehicleId,
          document: { type: DocumentType.POD },
        },
        include: { document: true },
      });
      if (pod) {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { status: VehicleStatus.COMPLETED },
        });
        const { syncSalesOrderStatusFromVehicle } = await import(
          "../../domain/common/status.rules"
        );
        await syncSalesOrderStatusFromVehicle(
          tx,
          tenantId,
          vehicleId,
          VehicleStatus.COMPLETED
        );
      }
    }
  }
}

@CommandHandler(UpdatePaymentRequestBeneficiaryCommand)
export class UpdatePaymentRequestBeneficiaryHandler
  implements
    ICommandHandler<UpdatePaymentRequestBeneficiaryCommand, PaymentRequestDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: UpdatePaymentRequestBeneficiaryCommand
  ): Promise<PaymentRequestDto> {
    const paymentRequest = await this.prisma.paymentRequest.findFirst({
      where: { id: command.paymentRequestId, tenantId: command.tenantId },
    });
    if (!paymentRequest) {
      throw new NotFoundException("Payment request not found");
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id: paymentRequest.id },
      data: { beneficiaryId: command.beneficiaryId },
    });

    return this.map(updated);
  }

  private map(request: any): PaymentRequestDto {
    return {
      id: request.id,
      tenantId: request.tenantId,
      salesOrderId: request.salesOrderId,
      vehicleId: request.vehicleId,
      transactionType: request.transactionType,
      paymentDate: request.paymentDate ? request.paymentDate.toISOString() : null,
      requestedAmount: request.requestedAmount,
      beneficiaryId: request.beneficiaryId,
      status: request.status,
      hasUnloadingCharge: !!request.hasUnloadingCharge,
      notes: request.notes ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(GetEligibleTransactionsForPaymentQuery)
export class GetEligibleTransactionsForPaymentHandler
  implements
    IQueryHandler<
      GetEligibleTransactionsForPaymentQuery,
      Array<
        BankTransactionDto & { remainingBalance: number; amountApplied: number }
      >
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: GetEligibleTransactionsForPaymentQuery
  ): Promise<
    Array<
      BankTransactionDto & { remainingBalance: number; amountApplied: number }
    >
  > {
    const paymentRequest = await this.prisma.paymentRequest.findFirst({
      where: { id: query.paymentRequestId, tenantId: query.tenantId },
    });
    if (!paymentRequest) {
      throw new NotFoundException("Payment request not found");
    }

    if (!paymentRequest.beneficiaryId) {
      return []; // No beneficiary selected, return empty list
    }

    const transactions = await this.prisma.bankTransaction.findMany({
      where: {
        tenantId: query.tenantId,
        beneficiaryId: paymentRequest.beneficiaryId,
      },
      include: {
        allocations: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter and map transactions with remaining balance > 0
    return transactions
      .map((tx) => {
        const amountApplied = tx.allocations.reduce(
          (sum, alloc) => sum + alloc.allocatedAmount,
          0
        );
        const remainingBalance = tx.totalPaidAmount - amountApplied;

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
          amountApplied,
        };
      })
      .filter((tx) => tx.remainingBalance > 0); // Only return transactions with remaining balance > 0
  }
}

@CommandHandler(LinkTransactionsToPaymentCommand)
export class LinkTransactionsToPaymentHandler
  implements
    ICommandHandler<
      LinkTransactionsToPaymentCommand,
      { paymentRequest: PaymentRequestDto; linkedTransactions: any[] }
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: LinkTransactionsToPaymentCommand
  ): Promise<{ paymentRequest: PaymentRequestDto; linkedTransactions: any[] }> {
    const paymentRequest = await this.prisma.paymentRequest.findFirst({
      where: { id: command.paymentRequestId, tenantId: command.tenantId },
      include: { allocations: true },
    });
    if (!paymentRequest) {
      throw new NotFoundException("Payment request not found");
    }

    // Calculate already allocated amount
    const alreadyAllocated = paymentRequest.allocations.reduce(
      (sum, alloc) => sum + alloc.allocatedAmount,
      0
    );
    const remainingAmount = paymentRequest.requestedAmount - alreadyAllocated;

    // Validate total allocation doesn't exceed remaining amount
    const totalAllocation = command.allocations.reduce(
      (sum, alloc) => sum + alloc.allocatedAmount,
      0
    );
    if (totalAllocation > remainingAmount) {
      throw new BadRequestException(
        `Total allocation (${totalAllocation}) exceeds remaining payment amount (${remainingAmount})`
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const linkedTransactions: any[] = [];
      let completionTransactionDate: Date | null = null;

      for (const allocation of command.allocations) {
        // Verify transaction exists and has sufficient remaining balance
        const transaction = await tx.bankTransaction.findFirst({
          where: {
            id: allocation.bankTransactionId,
            tenantId: command.tenantId,
          },
          include: { allocations: true },
        });
        if (!transaction) {
          throw new NotFoundException(
            `Transaction ${allocation.bankTransactionId} not found`
          );
        }

        const transactionAllocated = transaction.allocations.reduce(
          (sum, alloc) => sum + alloc.allocatedAmount,
          0
        );
        const transactionRemaining =
          transaction.totalPaidAmount - transactionAllocated;

        if (allocation.allocatedAmount > transactionRemaining) {
          throw new BadRequestException(
            `Allocation amount (${allocation.allocatedAmount}) exceeds transaction remaining balance (${transactionRemaining})`
          );
        }
        if (
          !completionTransactionDate ||
          (transaction.transactionDate &&
            (!completionTransactionDate || transaction.transactionDate.getTime() > completionTransactionDate.getTime()))
        ) {
          completionTransactionDate = transaction.transactionDate;
        }
        await tx.paymentAllocation.create({
          data: {
            tenantId: command.tenantId,
            paymentRequestId: command.paymentRequestId,
            bankTransactionId: allocation.bankTransactionId,
            allocatedAmount: allocation.allocatedAmount,
          },
        });

        // Recalculate remaining balance for this transaction
        const updatedTransaction = await tx.bankTransaction.findFirst({
          where: { id: allocation.bankTransactionId },
          include: { allocations: true },
        });
        if (updatedTransaction) {
          const newAllocated = updatedTransaction.allocations.reduce(
            (sum, alloc) => sum + alloc.allocatedAmount,
            0
          );
          linkedTransactions.push({
            ...updatedTransaction,
            remainingBalance: updatedTransaction.totalPaidAmount - newAllocated,
            amountApplied: newAllocated,
          });
        }
      }

      // Update payment request status if fully allocated
      const updatedPaymentRequest = await tx.paymentRequest.findFirst({
        where: { id: command.paymentRequestId },
        include: { allocations: true },
      });
      if (updatedPaymentRequest) {
        const totalAllocated = updatedPaymentRequest.allocations.reduce(
          (sum, alloc) => sum + alloc.allocatedAmount,
          0
        );
        if (totalAllocated >= updatedPaymentRequest.requestedAmount) {
          await tx.paymentRequest.update({
            where: { id: command.paymentRequestId },
            data: {
              status: PaymentRequestStatus.COMPLETED,
              paymentDate:
                completionTransactionDate ??
                updatedPaymentRequest.paymentDate ??
                new Date(),
            },
          });
        }
      }

      return { paymentRequest: updatedPaymentRequest, linkedTransactions };
    });

    return {
      paymentRequest: this.map(result.paymentRequest),
      linkedTransactions: result.linkedTransactions.map((tx) => ({
        id: tx.id,
        tenantId: tx.tenantId,
        transactionCode: tx.transactionCode,
        beneficiaryId: tx.beneficiaryId,
        totalPaidAmount: tx.totalPaidAmount,
        paymentDocumentId: tx.paymentDocumentId,
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString(),
        remainingBalance: tx.remainingBalance,
        amountApplied: tx.amountApplied,
      })),
    };
  }

  private map(request: any): PaymentRequestDto {
    return {
      id: request.id,
      tenantId: request.tenantId,
      salesOrderId: request.salesOrderId,
      vehicleId: request.vehicleId,
      transactionType: request.transactionType,
      paymentDate: request.paymentDate ? request.paymentDate.toISOString() : null,
      requestedAmount: request.requestedAmount,
      beneficiaryId: request.beneficiaryId,
      status: request.status,
      hasUnloadingCharge: !!request.hasUnloadingCharge,
      notes: request.notes ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }
}

export const PaymentHandlers = [
  CreatePaymentRequestHandler,
  ListPaymentRequestsHandler,
  GetPaymentRequestHandler,
  CompletePaymentRequestLinkTransactionHandler,
  CompletePaymentRequestsWithTransactionsHandler,
  ExportPaymentRequestsHandler,
  UpdatePaymentRequestBeneficiaryHandler,
  GetEligibleTransactionsForPaymentHandler,
  LinkTransactionsToPaymentHandler,
];
