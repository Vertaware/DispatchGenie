import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from "@nestjs/cqrs";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  LoadType,
  PaginatedResult,
  PaymentRequestStatus,
  PaymentRequestType,
  SalesOrderDto,
  SalesOrderStatus,
  TruckType,
  UserRole,
} from "~/enums/index";
import ExcelJS from "exceljs";
import { Prisma, $Enums } from "@prisma/client";
import {
  assertForwardSalesOrderStatus,
  deriveSalesOrderStatus,
  isHoldOrDeleteEligible,
  isSalesOrderFrozen,
  SalesOrderEligibilityCandidate,
} from "../../domain/common/status.rules";

type SortOrder = "asc" | "desc";

interface SalesOrderFilters {
  [key: string]: string | string[] | undefined;
}

const SALES_ORDER_STATUS_SET = new Set(Object.values(SalesOrderStatus));

const assertHoldDeleteEligibility = (status: SalesOrderStatus) => {
  if (!isHoldOrDeleteEligible(status)) {
    throw new BadRequestException(
      "Sales order can be put on hold or deleted only up to LOADING_COMPLETE status"
    );
  }
};

const ensureSalesOrderMutable = (status: SalesOrderStatus) => {
  if (isSalesOrderFrozen(status)) {
    throw new BadRequestException(
      "Sales order is on hold or deleted and cannot be updated"
    );
  }
};

const toPrismaSalesOrderStatus = (
  status: SalesOrderStatus
): $Enums.SalesOrderStatus => status as $Enums.SalesOrderStatus;

const canonicalizeSalesOrderPayload = (
  payload: Record<string, any>
): Record<string, any> => {
  if (!payload) {
    return {};
  }
  return Object.entries(payload).reduce<Record<string, any>>(
    (acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );
};

const resolveSalesOrderFilterField = (field: string): string => {
  if (field === "quantity") {
    return "soCases";
  }
  return field;
};

const normalizeStatusFilter = (
  value: string | string[]
): SalesOrderStatus[] | undefined => {
  const raw = Array.isArray(value) ? value : value.split(",");
  const statuses = raw
    .map((entry) => entry?.trim())
    .filter((entry): entry is SalesOrderStatus =>
      SALES_ORDER_STATUS_SET.has(entry as SalesOrderStatus)
    );
  return statuses.length > 0 ? statuses : undefined;
};

const applyStatusFilter = (
  where: Record<string, any>,
  value: string | string[]
) => {
  const statuses = normalizeStatusFilter(value);
  if (!statuses) {
    return;
  }
  where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
};

const normalizeLegacySalesOrderStatuses = async (
  _prisma: PrismaService
): Promise<void> => {};

/**
 * Process articles array and calculate soCases for each article
 * Always calculates soCases = articleQuantity (ignores client-sent soCases)
 * Creates Article master data records if they don't exist
 * Returns processed articles array and total soCases (sum of all article soCases)
 */
const processArticles = async (
  prisma: PrismaService,
  tenantId: string,
  articles?: any[]
): Promise<{
  processedArticles: any[] | null;
  totalSoCases: number | null;
}> => {
  if (!articles || !Array.isArray(articles) || articles.length === 0) {
    return { processedArticles: null, totalSoCases: null };
  }

  const processedArticles: any[] = [];
  let totalSoCases = 0;

  for (const article of articles) {
    const processedArticle: any = {
      articleId: null,
      articleDescription: article.articleDescription ?? null,
      articleQuantity: null,
    };

    // articleDescription is the primary identifier for the article
    // If we have an article description, ensure the Article master data exists
    if (
      processedArticle.articleDescription &&
      processedArticle.articleDescription.trim() !== ""
    ) {
      let articleRecord = null;

      // Priority 1: Find by description (case-insensitive) - articleDescription is the article
      articleRecord = await prisma.article.findFirst({
        where: {
          tenantId,
          description: {
            equals: processedArticle.articleDescription.trim(),
            mode: "insensitive",
          },
        },
      });

      // Priority 2: If not found by description, try to find by ID (if provided)
      // This handles cases where articleId was set but description doesn't match
      if (
        !articleRecord &&
        article.articleId &&
        article.articleId.trim() !== ""
      ) {
        articleRecord = await prisma.article.findFirst({
          where: { id: article.articleId, tenantId },
        });

        // If found by ID but description differs, update the description to match what user entered
        if (
          articleRecord &&
          articleRecord.description !==
            processedArticle.articleDescription.trim()
        ) {
          // Update the article description to match what the user entered
          articleRecord = await prisma.article.update({
            where: { id: articleRecord.id },
            data: { description: processedArticle.articleDescription.trim() },
          });
        }
      }

      // Priority 3: If still not found, create a new Article master data record
      if (!articleRecord) {
        // Use articleQuantity if provided, otherwise default to 0
        const defaultQuantity =
          article.articleQuantity !== undefined &&
          article.articleQuantity !== null
            ? article.articleQuantity
            : 0;

        articleRecord = await prisma.article.create({
          data: {
            tenantId,
            description: processedArticle.articleDescription.trim(),
            quantity: defaultQuantity,
          },
        });
      }

      // Set the articleId and description from the master data record
      // articleDescription is the source of truth
      processedArticle.articleId = articleRecord.id;
      processedArticle.articleDescription = articleRecord.description;

      // Priority 1: Use articleQuantity if provided (editable field from client)
      if (
        article.articleQuantity !== undefined &&
        article.articleQuantity !== null
      ) {
        processedArticle.articleQuantity = article.articleQuantity;
        totalSoCases += article.articleQuantity;
      }
      // Priority 2: Use the article's default quantity from master data
      else {
        processedArticle.articleQuantity = articleRecord.quantity;
        totalSoCases += articleRecord.quantity;
      }
    }
    // Note: SO Cases is calculated as total of all article quantities, not per article

    processedArticles.push(processedArticle);
  }

  return {
    processedArticles: processedArticles.length > 0 ? processedArticles : null,
    totalSoCases: totalSoCases > 0 ? totalSoCases : null,
  };
};

/**
 * Calculate total expenses from PaymentRequests for a sales order
 * Sums COMPLETED payment requests of types:
 * - ADVANCE_SHIPPING
 * - UNLOADING_CHARGE
 * - UNLOADING_DETENTION
 * - MISCELLANEOUS_CHARGES
 */
const calculateTotalExpenses = async (
  prisma: PrismaService,
  tenantId: string,
  salesOrderId: string
): Promise<number> => {
  const paymentRequests = await prisma.paymentRequest.findMany({
    where: {
      tenantId,
      salesOrderId,
      status: PaymentRequestStatus.COMPLETED,
      transactionType: {
        in: [
          PaymentRequestType.ADVANCE_SHIPPING,
          PaymentRequestType.UNLOADING_CHARGE,
          PaymentRequestType.UNLOADING_DETENTION,
          PaymentRequestType.MISCELLANEOUS_CHARGES,
        ] as any[],
      },
    },
  });

  return paymentRequests.reduce((sum, pr) => sum + pr.requestedAmount, 0);
};

export class CreateManualSalesOrderCommand {
  constructor(
    public readonly tenantId: string,
    public readonly payload: Record<string, any>,
    public readonly role: UserRole
  ) {}
}

export class UpdateManualSalesOrderCommand {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
    public readonly payload: Record<string, any>,
    public readonly role: UserRole
  ) {}
}

export class HoldSalesOrderCommand {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}

export class DeleteSalesOrderCommand {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}

export class ReactivateSalesOrderCommand {
  constructor(public readonly tenantId: string, public readonly id: string) {}
}

export class GetSalesOrderQuery {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
    public readonly role: UserRole
  ) {}
}

export class GetSalesOrderByNumberQuery {
  constructor(
    public readonly tenantId: string,
    public readonly soNumber: string,
    public readonly role: UserRole
  ) {}
}

export class SearchSalesOrdersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly searchTerm: string,
    public readonly excludeWithPayments: boolean = true
  ) {}
}

export class ListSalesOrdersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
    public readonly filters: SalesOrderFilters,
    public readonly role: UserRole
  ) {}
}

export class ImportSalesOrdersCommand {
  constructor(
    public readonly tenantId: string,
    public readonly fileName: string,
    public readonly buffer: Buffer
  ) {}
}

export interface SalesOrderImagePayload {
  soNumber: string;
  townName?: string;
  pinCode?: string;
  articleDescription?: string;
  category?: string;
  requestedTruckSize?: string;
  caseLot?: string;
  orderCases?: number;
}

export class UpsertSalesOrderImageCommand {
  constructor(
    public readonly tenantId: string,
    public readonly payload: SalesOrderImagePayload
  ) {}
}

export class ExportSalesOrdersQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters: SalesOrderFilters,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
    public readonly role: UserRole
  ) {}
}

interface ImportSummary {
  created: number;
  updated: number;
  errors: string[];
}

const toVehicleDto = (vehicle: any) => ({
  id: vehicle.id,
  tenantId: vehicle.tenantId,
  vehicleNumber: vehicle.vehicleNumber ?? null,
  driverName: vehicle.driverName ?? null,
  driverPhoneNumber: vehicle.driverPhoneNumber ?? null,
  placedTruckSize: vehicle.placedTruckSize ?? null,
  placedTruckType: vehicle.placedTruckType ?? null,
  loadType: vehicle.loadType,
  vehicleAmount: vehicle.vehicleAmount ?? null,
  vehicleExpense: vehicle.vehicleExpense ?? null,
  location: vehicle.location,
  locationReachedAt: vehicle.locationReachedAt?.toISOString() ?? null,
  unloadedAt: vehicle.unloadedAt?.toISOString() ?? null,
  billedOn: vehicle.billedOn?.toISOString() ?? null,
  filledOn: vehicle.filledOn?.toISOString() ?? null,
  dbWaitingTimeHours: vehicle.dbWaitingTimeHours,
  loadingQuantity: vehicle.loadingQuantity ?? null,
  checkInAt: vehicle.checkInAt?.toISOString() ?? null,
  gateInAt: vehicle.gateInAt?.toISOString() ?? null,
  gateOutAt: vehicle.gateOutAt?.toISOString() ?? null,
  loadingStartedAt: vehicle.loadingStartedAt?.toISOString() ?? null,
  loadingCompletedAt: vehicle.loadingCompletedAt?.toISOString() ?? null,
  status: vehicle.status,
  invoiceStatus: vehicle.invoiceStatus,
  isPaid: vehicle.isPaid,
  profit: vehicle.profit,
  createdAt: vehicle.createdAt.toISOString(),
  updatedAt: vehicle.updatedAt.toISOString(),
});

const toSalesOrderDto = (order: any, role?: UserRole): SalesOrderDto => {
  const soCases = order.soCases ?? null;
  const townName = order.townName ?? null;
  const pinCode = order.pinCode ?? null;
  const requestedTruckSize = order.requestedTruckSize ?? null;
  const partyAddress = order.partyAddress ?? null;
  const requestedTruckType =
    (order.requestedTruckType as TruckType | null) ?? null;

  // Parse articles from JSON field
  let articles: any[] | null = null;
  if (order.articles) {
    try {
      articles =
        typeof order.articles === "string"
          ? JSON.parse(order.articles)
          : order.articles;
      if (!Array.isArray(articles)) {
        articles = null;
      }
    } catch {
      articles = null;
    }
  }

  const dto: SalesOrderDto = {
    id: order.id,
    tenantId: order.tenantId,
    soNumber: order.soNumber,
    soDate: order.soDate.toISOString(),
    customerId: order.customerId,
    customerName: order.customerName,
    partyName: order.partyName,
    townName,
    pinCode,
    sku: order.sku,
    articleDescription: order.articleDescription,
    notes: order.notes ?? null,
    tripReferenceNo: order.tripReferenceNo ?? null,
    soCases,
    quantity: soCases,
    caseLot: order.caseLot,
    requestedTruckSize,
    requestedTruckType,
    category: order.category ?? null,
    partyAddress,
    status: order.status as SalesOrderStatus,
    previousStatus: (order.previousStatus as SalesOrderStatus | null) ?? null,
    finalAmount: order.finalAmount,
    loadingQuantity: order.loadingQuantity,
    createdFromImport: order.createdFromImport,
    fieldSource: order.fieldSource,
    articles,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    placedTruckSize: order.placedTruckSize ?? null,
    placedTruckType: (order.placedTruckType as TruckType | null) ?? null,
    loadType: (order.loadType as LoadType | null) ?? null,
    profit: order.profit ?? null,
  };
  if (role === UserRole.LOGISTIC_WORKER) {
    dto.finalAmount = null;
  }
  // Only admin can see frightCost
  if (role === UserRole.ADMIN) {
    dto.frightCost = order.frightCost ?? null;
  } else {
    dto.frightCost = null;
  }
  if (order.vehicleLinks) {
    dto.vehicles = order.vehicleLinks.map((link: any) =>
      toVehicleDto(link.vehicle)
    );
  }
  return dto;
};

@CommandHandler(CreateManualSalesOrderCommand)
export class CreateManualSalesOrderHandler
  implements ICommandHandler<CreateManualSalesOrderCommand, SalesOrderDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: CreateManualSalesOrderCommand
  ): Promise<SalesOrderDto> {
    const { tenantId, role } = command;
    const payload = canonicalizeSalesOrderPayload(command.payload);
    if (!payload.soNumber) {
      throw new BadRequestException("soNumber is required");
    }
    const existing = await this.prisma.salesOrder.findFirst({
      where: { tenantId, soNumber: payload.soNumber },
    });
    if (existing) {
      throw new ConflictException("Sales order number already exists");
    }
    // Filter frightCost: only admin can set it, others get 0
    const frightCost = role === UserRole.ADMIN ? payload.frightCost ?? 0 : 0;
    // Profit should not be set by client
    if (payload.profit !== undefined) {
      delete payload.profit;
    }

    // Process articles and calculate soCases
    const { processedArticles, totalSoCases } = await processArticles(
      this.prisma,
      tenantId,
      payload.articles
    );

    // Always use calculated totalSoCases if articles are provided, otherwise use payload.soCases
    // But if articles exist, ignore client-sent soCases and use calculated total
    const finalSoCases =
      totalSoCases !== null
        ? totalSoCases
        : processedArticles
        ? null
        : payload.soCases ?? null;

    const fieldSource = this.createFieldSource(payload);
    const data = {
      tenantId,
      soNumber: payload.soNumber,
      soDate: payload.soDate ? new Date(payload.soDate) : new Date(),
      customerId: payload.customerId ?? null,
      customerName: payload.customerName ?? null,
      partyName: payload.partyName ?? null,
      townName: payload.townName ?? null,
      pinCode: payload.pinCode ?? null,
      sku: payload.sku ?? null,
      articleDescription: payload.articleDescription ?? null,
      soCases: finalSoCases,
      requestedOrderQuantity: payload.requestedOrderQuantity ?? null,
      caseLot: payload.caseLot ?? null,
      unitPrice: payload.unitPrice ?? null,
      plant: payload.plant ?? null,
      requestedTruckSize: payload.requestedTruckSize ?? null,
      requestedTruckType: payload.requestedTruckType ?? null,
      placedTruckSize: payload.placedTruckSize ?? null,
      placedTruckType: payload.placedTruckType ?? null,
      loadType: payload.loadType ?? null,
      category: payload.category ?? null,
      partyAddress: payload.partyAddress ?? null,
      loadingQuantity: payload.loadingQuantity ?? null,
      actualUnloadingCharges: payload.actualUnloadingCharges ?? null,
      otherExpenses: payload.otherExpenses ?? null,
      advancePayment: payload.advancePayment ?? null,
      finalPayment: payload.finalPayment ?? null,
      frightCost,
      profit: null,
      invoiceEwayBill: payload.invoiceEwayBill ?? null,
      lrNumber: payload.lrNumber ?? null,
      notes: payload.notes ?? null,
      tripReferenceNo: payload.tripReferenceNo ?? null,
      lrCopyDocumentId: payload.lrCopyDocumentId ?? null,
      podCopyDocumentId: payload.podCopyDocumentId ?? null,
      loadingPhotosDocumentIds: payload.loadingPhotosDocumentIds ?? null,
      advancePaymentScreenshotDocumentId:
        payload.advancePaymentScreenshotDocumentId ?? null,
      finalPaymentScreenshotDocumentId:
        payload.finalPaymentScreenshotDocumentId ?? null,
      unloadingExpensesScreenshotDocumentId:
        payload.unloadingExpensesScreenshotDocumentId ?? null,
      uid: payload.uid ?? null,
      duplicates: payload.duplicates ?? null,
      flag: payload.flag ?? null,
      finalAmount: payload.finalAmount ?? null,
      createdFromImport: false,
      fieldSource,
      articles: processedArticles ? JSON.stringify(processedArticles) : null,
    };
    const status = deriveSalesOrderStatus(data);
    const created = await this.prisma.salesOrder.create({
      data: { ...data, status: toPrismaSalesOrderStatus(status) },
    });
    return toSalesOrderDto(created, role);
  }

  private createFieldSource(payload: Record<string, any>) {
    const map: Record<string, "manual"> = {};
    Object.keys(payload).forEach((key) => {
      if (payload[key] !== undefined && payload[key] !== null) {
        map[key] = "manual";
      }
    });
    return map;
  }
}

@CommandHandler(UpdateManualSalesOrderCommand)
export class UpdateManualSalesOrderHandler
  implements ICommandHandler<UpdateManualSalesOrderCommand, SalesOrderDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    command: UpdateManualSalesOrderCommand
  ): Promise<SalesOrderDto> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const { tenantId, id, role } = command;
    const payload = canonicalizeSalesOrderPayload(command.payload);
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId },
    });
    if (!order) {
      throw new NotFoundException("Sales order not found");
    }
    const orderStatus = order.status as SalesOrderStatus;
    ensureSalesOrderMutable(orderStatus);
    if (
      payload.status &&
      (payload.status === SalesOrderStatus.HOLD ||
        payload.status === SalesOrderStatus.DELETED)
    ) {
      throw new BadRequestException(
        "Use hold/delete actions to change this sales order status"
      );
    }
    // Filter frightCost: only admin can set it, others ignore it (keep existing value or 0)
    if (payload.frightCost !== undefined) {
      if (role !== UserRole.ADMIN) {
        // Non-admin cannot set frightCost, remove it from payload
        delete payload.frightCost;
      }
    }
    // Profit should not be set by client
    if (payload.profit !== undefined) {
      delete payload.profit;
    }

    // Process articles if provided
    let processedArticles: any[] | null = null;
    let totalSoCases: number | null = null;
    if (payload.articles !== undefined) {
      const result = await processArticles(
        this.prisma,
        tenantId,
        payload.articles
      );
      processedArticles = result.processedArticles;
      totalSoCases = result.totalSoCases;
    }

    const fieldSource = (order.fieldSource ?? {}) as Record<
      string,
      "manual" | "import" | "image"
    >;
    const data: Record<string, any> = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (key === "soDate") {
        data[key] = value ? new Date(value as string) : null;
      } else if (key === "articles") {
        // Skip articles here, we'll handle it separately
        return;
      } else if (key === "soCases") {
        // Always ignore client-sent soCases if articles are provided
        // Use calculated totalSoCases instead
        if (totalSoCases !== null) {
          data[key] = totalSoCases;
        } else if (processedArticles === null) {
          // Only use client-sent soCases if no articles are being processed
          data[key] = value ?? null;
        }
        // If articles are being processed but totalSoCases is null, don't set soCases
        return;
      } else if (key !== "status") {
        data[key] = value ?? null;
      }
      if (key !== "status" && key !== "articles") {
        fieldSource[key] = "manual";
      }
    });

    // Add processed articles to data
    if (processedArticles !== null) {
      data.articles = JSON.stringify(processedArticles);
      fieldSource.articles = "manual";
    }
    const candidate = { ...order, ...data };
    const derivedStatus = deriveSalesOrderStatus(candidate as SalesOrderEligibilityCandidate);
    let nextStatus = orderStatus;
    const isStatusTransition = payload.status !== undefined;
    if (payload.status) {
      const requestedStatus = payload.status as SalesOrderStatus;
      assertForwardSalesOrderStatus(orderStatus, requestedStatus);
      nextStatus = requestedStatus;
    } else if (
      orderStatus === SalesOrderStatus.INFORMATION_NEEDED &&
      derivedStatus === SalesOrderStatus.ASSIGN_VEHICLE
    ) {
      nextStatus = derivedStatus;
    }

    // Calculate profit when transitioning to COMPLETED or INVOICED
    const shouldCalculateProfit =
      (nextStatus === SalesOrderStatus.COMPLETED ||
        nextStatus === SalesOrderStatus.INVOICED) &&
      (isStatusTransition ||
        orderStatus === SalesOrderStatus.COMPLETED ||
        orderStatus === SalesOrderStatus.INVOICED);

    if (shouldCalculateProfit) {
      const frightCost = data.frightCost ?? order.frightCost ?? 0;
      const totalExpenses = await calculateTotalExpenses(
        this.prisma,
        tenantId,
        id
      );
      data.profit = frightCost - totalExpenses;
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id: order.id },
      data: {
        ...data,
        fieldSource,
        status: toPrismaSalesOrderStatus(nextStatus),
      },
    });
    return toSalesOrderDto(updated, role);
  }
}

@CommandHandler(HoldSalesOrderCommand)
export class HoldSalesOrderHandler
  implements ICommandHandler<HoldSalesOrderCommand, SalesOrderDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: HoldSalesOrderCommand): Promise<SalesOrderDto> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const { tenantId, id } = command;
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId },
    });
    if (!order) {
      throw new NotFoundException("Sales order not found");
    }
    const currentStatus = order.status as SalesOrderStatus;
    assertHoldDeleteEligibility(currentStatus);
    const previousStatus =
      ((order as any).previousStatus as SalesOrderStatus | null) ??
      currentStatus;
    const updated = await this.prisma.salesOrder.update({
      where: { id: order.id },
      data: {
        status: toPrismaSalesOrderStatus(SalesOrderStatus.HOLD),
        previousStatus: previousStatus as any,
      } as any,
    });
    return toSalesOrderDto(updated);
  }
}

@CommandHandler(DeleteSalesOrderCommand)
export class DeleteSalesOrderHandler
  implements ICommandHandler<DeleteSalesOrderCommand, SalesOrderDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: DeleteSalesOrderCommand): Promise<SalesOrderDto> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const { tenantId, id } = command;
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId },
    });
    if (!order) {
      throw new NotFoundException("Sales order not found");
    }
    const currentStatus = order.status as SalesOrderStatus;
    assertHoldDeleteEligibility(currentStatus);
    const previousStatus =
      ((order as any).previousStatus as SalesOrderStatus | null) ??
      currentStatus;
    const updated = await this.prisma.salesOrder.update({
      where: { id: order.id },
      data: {
        status: toPrismaSalesOrderStatus(SalesOrderStatus.DELETED),
        previousStatus: previousStatus as any,
      } as any,
    });
    return toSalesOrderDto(updated);
  }
}

@CommandHandler(ReactivateSalesOrderCommand)
export class ReactivateSalesOrderHandler
  implements ICommandHandler<ReactivateSalesOrderCommand, SalesOrderDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ReactivateSalesOrderCommand): Promise<SalesOrderDto> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const { tenantId, id } = command;
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId },
    });
    if (!order) {
      throw new NotFoundException("Sales order not found");
    }
    const currentStatus = order.status as SalesOrderStatus;
    if (!isSalesOrderFrozen(currentStatus)) {
      throw new BadRequestException(
        "Only held or deleted sales orders can be reactivated"
      );
    }
    const previousStatus = (order as any)
      .previousStatus as SalesOrderStatus | null;
    const targetStatus = previousStatus ?? SalesOrderStatus.INFORMATION_NEEDED;
    const updated = await this.prisma.salesOrder.update({
      where: { id: order.id },
      data: {
        status: toPrismaSalesOrderStatus(targetStatus),
        previousStatus: null,
      } as any,
    });
    return toSalesOrderDto(updated);
  }
}

@CommandHandler(UpsertSalesOrderImageCommand)
export class UpsertSalesOrderImageHandler
  implements ICommandHandler<UpsertSalesOrderImageCommand, SalesOrderDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpsertSalesOrderImageCommand): Promise<SalesOrderDto> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const { tenantId, payload } = command;
    const soNumber = payload.soNumber?.trim();
    if (!soNumber) {
      throw new BadRequestException("soNumber is required");
    }
    const normalized = this.normalizePayload(payload);
    const existing = await this.prisma.salesOrder.findFirst({
      where: { tenantId, soNumber },
    });
    if (!existing) {
      const fieldSource: Record<string, "image"> = {};
      Object.entries(normalized).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          fieldSource[key] = "image";
        }
      });
      const candidate = {
        soNumber,
        ...normalized,
      };
      const status = deriveSalesOrderStatus(candidate);
      const created = await this.prisma.salesOrder.create({
        data: {
          tenantId,
          soNumber,
          soDate: new Date(),
          customerId: null,
          customerName: null,
          partyName: null,
          status: toPrismaSalesOrderStatus(status),
          createdFromImport: false,
          fieldSource,
          ...normalized,
        },
      });
      return toSalesOrderDto(created);
    }
    if (isSalesOrderFrozen(existing.status as SalesOrderStatus)) {
      throw new BadRequestException(
        "Sales order is on hold or deleted and cannot be updated"
      );
    }
    const fieldSource = (existing.fieldSource ?? {}) as Record<
      string,
      "manual" | "import" | "image"
    >;
    const updates: Record<string, any> = {};
    Object.entries(normalized).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      const currentSource = fieldSource[key];
      if (currentSource && currentSource !== "image") {
        return;
      }
      updates[key] = value;
      fieldSource[key] = "image";
    });
    if (Object.keys(updates).length === 0) {
      return toSalesOrderDto(existing);
    }
    const candidate = { ...existing, ...updates };
    const derivedStatus = deriveSalesOrderStatus(
      candidate as SalesOrderEligibilityCandidate
    );
    let nextStatus = existing.status as SalesOrderStatus;
    if (
      nextStatus === SalesOrderStatus.INFORMATION_NEEDED &&
      derivedStatus === SalesOrderStatus.ASSIGN_VEHICLE
    ) {
      nextStatus = derivedStatus;
    }
    const updated = await this.prisma.salesOrder.update({
      where: { id: existing.id },
      data: {
        ...updates,
        fieldSource,
        status: toPrismaSalesOrderStatus(nextStatus),
      },
    });
    return toSalesOrderDto(updated);
  }

  private normalizePayload(payload: SalesOrderImagePayload) {
    const raw = {
      townName: this.clean(payload.townName),
      pinCode: this.clean(payload.pinCode),
      articleDescription: this.clean(payload.articleDescription),
      category: this.clean(payload.category),
      requestedTruckSize: this.clean(payload.requestedTruckSize),
      caseLot: this.clean(payload.caseLot),
      soCases:
        typeof payload.orderCases === "number" &&
        Number.isFinite(payload.orderCases)
          ? payload.orderCases
          : undefined,
    };
    return canonicalizeSalesOrderPayload(raw);
  }

  private clean(value?: string | null): string | null | undefined {
    if (value == null) {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed;
  }
}

@QueryHandler(GetSalesOrderQuery)
export class GetSalesOrderHandler
  implements IQueryHandler<GetSalesOrderQuery, SalesOrderDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetSalesOrderQuery): Promise<SalesOrderDto> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
    });
    if (!order) {
      throw new NotFoundException("Sales order not found");
    }
    return toSalesOrderDto(order, query.role);
  }
}

@QueryHandler(GetSalesOrderByNumberQuery)
export class GetSalesOrderByNumberHandler
  implements IQueryHandler<GetSalesOrderByNumberQuery, SalesOrderDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetSalesOrderByNumberQuery): Promise<SalesOrderDto> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const order = await this.prisma.salesOrder.findFirst({
      where: {
        soNumber: query.soNumber,
        tenantId: query.tenantId,
        // Only include sales orders with assigned vehicles
        vehicleLinks: {
          some: {},
        },
      },
      include: {
        vehicleLinks: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        "Sales order not found or no vehicle assigned"
      );
    }

    return toSalesOrderDto(order, query.role);
  }
}

@QueryHandler(SearchSalesOrdersQuery)
export class SearchSalesOrdersHandler
  implements IQueryHandler<SearchSalesOrdersQuery, SalesOrderDto[]>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: SearchSalesOrdersQuery): Promise<SalesOrderDto[]> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const where: any = {
      tenantId: query.tenantId,
      soNumber: {
        contains: query.searchTerm,
        mode: "insensitive",
      },
      // Only include sales orders with assigned vehicles
      vehicleLinks: {
        some: {},
      },
    };

    // Exclude sales orders that already have payment requests
    if (query.excludeWithPayments) {
      where.paymentRequests = {
        none: {},
      };
    }

    const orders = await this.prisma.salesOrder.findMany({
      where,
      take: 10, // Limit to 10 suggestions
      orderBy: { soNumber: "asc" },
      include: {
        vehicleLinks: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    return orders.map((order) => toSalesOrderDto(order));
  }
}

@QueryHandler(ListSalesOrdersQuery)
export class ListSalesOrdersHandler
  implements
    IQueryHandler<ListSalesOrdersQuery, PaginatedResult<SalesOrderDto>>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ListSalesOrdersQuery
  ): Promise<PaginatedResult<SalesOrderDto>> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === "desc" ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.SalesOrderOrderByWithRelationInput = query.sortBy
      ? ({
          [query.sortBy]: direction,
        } as Prisma.SalesOrderOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };

    const [totalCount, orders] = await this.prisma.$transaction([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
      }),
    ]);

    const data = orders.map((o) => toSalesOrderDto(o, query.role));
    return { data, page, pageSize, totalCount };
  }

  private buildWhere(tenantId: string, filters: SalesOrderFilters) {
    const where: any = { tenantId };
    if (!filters) {
      return where;
    }
    const mapField = (value: any) => {
      if (Array.isArray(value)) {
        return { in: value };
      }
      if (typeof value === "string" && value.includes(",")) {
        return { in: value.split(",") };
      }
      return { contains: value, mode: "insensitive" };
    };
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      const fieldKey = this.resolveFilterField(key);
      switch (key) {
        case "status":
          applyStatusFilter(where, value);
          break;
        case "fromDate":
        case "toDate":
          where.soDate = where.soDate ?? {};
          if (key === "fromDate") {
            where.soDate.gte = new Date(String(value));
          } else {
            where.soDate.lte = new Date(String(value));
          }
          break;
        default:
          where[fieldKey] = mapField(value);
      }
    });
    return where;
  }

  private resolveFilterField(key: string) {
    return resolveSalesOrderFilterField(key);
  }
}

@CommandHandler(ImportSalesOrdersCommand)
export class ImportSalesOrdersHandler
  implements ICommandHandler<ImportSalesOrdersCommand, ImportSummary>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ImportSalesOrdersCommand): Promise<ImportSummary> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const { buffer, fileName, tenantId } = command;
    if (!/\.(xls|xlsx|csv)$/i.test(fileName)) {
      throw new BadRequestException("Unsupported file type");
    }

    const rows = await this.parseRows(buffer, fileName);
    const summary: ImportSummary = { created: 0, updated: 0, errors: [] };

    for (const [index, row] of rows.entries()) {
      const mapped = this.mapRow(row as Record<string, any>);
      if (!mapped.soNumber) {
        summary.errors.push(`Row ${index + 2}: Missing soNumber`);
        continue;
      }
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.salesOrder.findFirst({
          where: { tenantId, soNumber: mapped.soNumber },
        });
        if (!existing) {
          const fieldSource: Record<string, "import"> = {};
          Object.keys(mapped).forEach((key) => {
            if (mapped[key] !== undefined && mapped[key] !== null) {
              fieldSource[key] = "import";
            }
          });
          const status = deriveSalesOrderStatus(mapped);
          await tx.salesOrder.create({
            data: {
              ...mapped,
              tenantId,
              soNumber: mapped.soNumber,
              soDate: mapped.soDate ? new Date(mapped.soDate) : new Date(),
              status: toPrismaSalesOrderStatus(status),
              createdFromImport: true,
              fieldSource,
            } as Prisma.SalesOrderUncheckedCreateInput,
          });
          summary.created += 1;
        } else {
          if (isSalesOrderFrozen(existing.status as SalesOrderStatus)) {
            summary.errors.push(
              `SO ${existing.soNumber}: sales order is ${existing.status} and cannot be updated`
            );
            return;
          }
          const fieldSource = (existing.fieldSource ?? {}) as Record<
            string,
            "manual" | "import" | "image"
          >;
          const updates: Record<string, any> = {};
          Object.entries(mapped).forEach(([key, value]) => {
            if (value === undefined) return;
            const source = fieldSource[key];
            if (source === "manual") {
              return;
            }
            updates[key] = key === "soDate" && value ? new Date(value) : value;
            fieldSource[key] = "import";
          });
          if (Object.keys(updates).length > 0) {
            const candidate = { ...existing, ...updates };
            const derivedStatus = deriveSalesOrderStatus(
              candidate as SalesOrderEligibilityCandidate
            );
            let nextStatus = existing.status as SalesOrderStatus;
            if (
              nextStatus === SalesOrderStatus.INFORMATION_NEEDED &&
              derivedStatus === SalesOrderStatus.ASSIGN_VEHICLE
            ) {
              nextStatus = derivedStatus;
            }
            await tx.salesOrder.update({
              where: { id: existing.id },
              data: {
                ...updates,
                fieldSource,
                status: toPrismaSalesOrderStatus(nextStatus),
              },
            });
            summary.updated += 1;
          }
        }
      });
    }
    return summary;
  }

  private async parseRows(
    buffer: Buffer,
    fileName: string
  ): Promise<Record<string, any>[]> {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (extension === "csv") {
      const content = buffer.toString("utf-8");
      return this.parseCsvContent(content);
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch (error) {
      throw new BadRequestException("Unable to read Excel file");
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException("Empty workbook");
    }
    const headerRow = worksheet.getRow(1);
    const headerCellCount = headerRow.cellCount ?? 0;
    const headers: string[] = [];
    for (let column = 1; column <= headerCellCount; column += 1) {
      const rawHeader = this.getCellValue(headerRow.getCell(column).value);
      headers.push(rawHeader != null ? String(rawHeader).trim() : "");
    }
    if (headers.length === 0 || headers.every((header) => !header)) {
      throw new BadRequestException("Missing header row in import file");
    }

    const results: Record<string, any>[] = [];
    const rowCount = worksheet.rowCount ?? 0;
    for (let rowNumber = 2; rowNumber <= rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!row || row.cellCount === 0) {
        continue;
      }
      const record: Record<string, any> = {};
      let hasData = false;
      headers.forEach((header, index) => {
        if (!header || index === 0) {
          return;
        }
        const cell = row.getCell(index + 1);
        const value = this.getCellValue(cell?.value);
        record[header] = value;
        if (value !== null && value !== undefined && value !== "") {
          hasData = true;
        }
      });
      if (hasData) {
        results.push(record);
      }
    }
    return results;
  }

  private parseCsvContent(content: string): Record<string, any>[] {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      return [];
    }
    const headers = this.splitCsvLine(lines.shift() ?? "").map((header) =>
      header.trim()
    );
    if (headers.length === 0 || headers.every((header) => !header)) {
      throw new BadRequestException("Missing header row in import file");
    }
    const records: Record<string, any>[] = [];
    lines.forEach((line) => {
      const values = this.splitCsvLine(line);
      if (values.every((value) => value === "" || value == null)) {
        return;
      }
      const record: Record<string, any> = {};
      headers.forEach((header, index) => {
        if (!header) {
          return;
        }
        const raw = values[index] ?? "";
        const trimmed = raw.trim();
        record[header] = trimmed.length > 0 ? trimmed : null;
      });
      records.push(record);
    });
    return records;
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  private getCellValue(value: unknown): unknown {
    if (value == null) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      return value.trim();
    }
    if (typeof value === "object") {
      const typed = value as any;
      if (typed.text) {
        return typed.text;
      }
      if (typed.result) {
        return typed.result;
      }
      if (Array.isArray(typed.richText)) {
        return typed.richText.map((item: any) => item.text ?? "").join("");
      }
      if (typed.hyperlink) {
        return typed.text ?? typed.hyperlink;
      }
      if (typed.value) {
        return typed.value;
      }
      return null;
    }
    return value;
  }

  private mapRow(row: Record<string, any>): Record<string, any> {
    const normalizeKey = (key: string) =>
      key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const normalizedEntries = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
    );
    const pickValue = (keys: string[]) => {
      for (const key of keys) {
        const normalizedKey = normalizeKey(key);
        if (normalizedEntries[normalizedKey] !== undefined) {
          return normalizedEntries[normalizedKey];
        }
      }
      return undefined;
    };
    const pickString = (...keys: string[]) => {
      const raw = pickValue(keys);
      if (raw == null) {
        return undefined;
      }
      const trimmed = String(raw).trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };
    const pickNumber = (...keys: string[]) => {
      const raw = pickValue(keys);
      if (raw == null || raw === "") {
        return undefined;
      }
      if (typeof raw === "number") {
        return Number.isFinite(raw) ? raw : undefined;
      }
      const parsed = Number(String(raw).replace(/,/g, ""));
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const raw = {
      soNumber: pickString(
        "sonumber",
        "so number",
        "sales order no",
        "sales order no.",
        "sales order",
        "so"
      ),
      soDate: pickString("sodate", "so date", "sales order date"),
      customerId: pickString(
        "customerid",
        "customer id",
        "customer code",
        "uid"
      ),
      customerName: pickString("customername", "customer name"),
      partyName: pickString("partyname", "party name"),
      townName: pickString("townname", "town", "location", "city", "plant"),
      pinCode: pickString("pincode", "pin code", "postcode"),
      sku: pickString("sku", "articlecode", "article code"),
      articleDescription: pickString(
        "articledescription",
        "article description",
        "article desc"
      ),
      soCases: pickNumber("socases", "so cases", "quantity", "soqty", "so qty"),
      caseLot: pickString("caselot", "case lot"),
      requestedTruckSize: pickString(
        "trucksize",
        "requestedtrucksize",
        "requested truck size"
      ),
      category: pickString("category", "cat type"),
      partyAddress: pickString("address", "addreess"),
      finalAmount: pickNumber("finalamount", "unitprice", "unit price"),
      loadingQuantity: pickNumber("loadingquantity"),
    } as Record<string, any>;
    return canonicalizeSalesOrderPayload(raw);
  }
}

@QueryHandler(ExportSalesOrdersQuery)
export class ExportSalesOrdersHandler
  implements
    IQueryHandler<ExportSalesOrdersQuery, { fileName: string; buffer: Buffer }>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ExportSalesOrdersQuery
  ): Promise<{ fileName: string; buffer: Buffer }> {
    await normalizeLegacySalesOrderStatuses(this.prisma);
    const where = {
      tenantId: query.tenantId,
      ...this.buildFilters(query.filters),
    };
    const direction: Prisma.SortOrder =
      query.sortOrder === "desc" ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.SalesOrderOrderByWithRelationInput = query.sortBy
      ? ({
          [query.sortBy]: direction,
        } as Prisma.SalesOrderOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const orders = await this.prisma.salesOrder.findMany({
      where,
      orderBy,
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Orders");
    sheet.columns = [
      { header: "Sales Order No", key: "soNumber", width: 20 },
      { header: "SO Date", key: "soDate", width: 20 },
      { header: "Customer ID", key: "customerId", width: 20 },
      { header: "Customer Name", key: "customerName", width: 25 },
      { header: "Party Name", key: "partyName", width: 25 },
      { header: "Town Name", key: "townName", width: 20 },
      { header: "Pin Code", key: "pinCode", width: 15 },
      { header: "SKU", key: "sku", width: 20 },
      { header: "Article Description", key: "articleDescription", width: 30 },
      { header: "SO Cases", key: "soCases", width: 12 },
      { header: "Case Lot", key: "caseLot", width: 12 },
      { header: "Requested Truck Size", key: "requestedTruckSize", width: 22 },
      { header: "Loading Quantity", key: "loadingQuantity", width: 18 },
      { header: "Status", key: "status", width: 20 },
      { header: "Final Amount", key: "finalAmount", width: 20 },
    ];
    orders.forEach((order) => {
      const townName = order.townName ?? "";
      const pinCode = order.pinCode ?? "";
      const requestedTruckSize = order.requestedTruckSize ?? "";
      sheet.addRow({
        soNumber: order.soNumber,
        soDate: order.soDate.toISOString(),
        customerId: order.customerId,
        customerName: order.customerName,
        partyName: order.partyName,
        townName,
        pinCode,
        sku: order.sku,
        articleDescription: order.articleDescription,
        soCases: order.soCases ?? "",
        caseLot: order.caseLot,
        requestedTruckSize,
        loadingQuantity: order.loadingQuantity,
        status: order.status as SalesOrderStatus,
        finalAmount:
          query.role === UserRole.LOGISTIC_WORKER
            ? ""
            : order.finalAmount ?? "",
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: `sales-orders-${new Date().toISOString()}.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  private buildFilters(filters: SalesOrderFilters) {
    if (!filters) {
      return {};
    }
    const where: any = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      switch (key) {
        case "status":
          applyStatusFilter(where, value);
          break;
        case "fromDate":
        case "toDate":
          where.soDate = where.soDate ?? {};
          if (key === "fromDate") where.soDate.gte = new Date(String(value));
          else where.soDate.lte = new Date(String(value));
          break;
        default:
          where[resolveSalesOrderFilterField(key)] = {
            contains: value,
            mode: "insensitive",
          };
      }
    });
    return where;
  }
}

export const SalesOrderHandlers = [
  CreateManualSalesOrderHandler,
  UpdateManualSalesOrderHandler,
  HoldSalesOrderHandler,
  DeleteSalesOrderHandler,
  ReactivateSalesOrderHandler,
  UpsertSalesOrderImageHandler,
  GetSalesOrderHandler,
  GetSalesOrderByNumberHandler,
  SearchSalesOrdersHandler,
  ListSalesOrdersHandler,
  ImportSalesOrdersHandler,
  ExportSalesOrdersHandler,
];
