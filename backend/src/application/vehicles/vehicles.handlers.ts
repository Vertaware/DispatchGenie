import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from "@nestjs/cqrs";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  AuthenticatedUser,
  DocumentDto,
  DocumentType,
  LoadType,
  TruckType,
  PaginatedResult,
  SalesOrderDto,
  SalesOrderStatus,
  UserRole,
  VehicleDto,
  VehicleInvoiceStatus,
  VehicleStatus,
} from "~/enums/index";
import ExcelJS from "exceljs";
import {
  DocumentManager,
  DocumentFilePayload,
} from "../../infrastructure/documents/document.manager";
import { Prisma, $Enums } from "@prisma/client";
import {
  assertForwardSalesOrderStatus,
  assertForwardVehicleStatus,
  deriveSalesOrderStatus,
  getMissingSalesOrderEligibilityFields,
  isSalesOrderVehicleEligible,
  isAfterLoadingComplete,
  isSalesOrderFrozen,
} from "../../domain/common/status.rules";

type SortOrder = "asc" | "desc";

export interface AssignVehiclePayload {
  salesOrderIds: string[];
  vehicleId?: string;
  vehicleNumber?: string;
  driverName?: string;
  vehicleName?: string; // legacy alias
  driverPhoneNumber?: string;
  driverPhone?: string; // legacy alias
  asmPhoneNumber?: string;
  placedTruckSize?: string;
  truckSize?: string; // legacy alias
  placedTruckType?: string;
  truckType?: string; // legacy alias
  loadType?: string;
  vehicleAmount?: number;
  shippingAmount?: number; // legacy alias
  vehicleExpense?: number;
  shippingExpense?: number; // legacy alias
  location?: string;
}

export class AssignVehicleCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userRole: UserRole,
    public readonly payload: AssignVehiclePayload
  ) {}
}

export class ListVehiclesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
    public readonly filters: Record<string, string>,
    public readonly role: UserRole
  ) {}
}

export class GetVehicleQuery {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
    public readonly role: UserRole
  ) {}
}

export class UpdateVehicleCommand {
  constructor(
    public readonly tenantId: string,
    public readonly id: string,
    public readonly payload: Record<string, any>,
    public readonly role: UserRole
  ) {}
}

export class SearchVehiclesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly searchTerm: string
  ) {}
}

export class ExportVehiclesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters: Record<string, string>,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
    public readonly role: UserRole
  ) {}
}

export class UploadVehiclePodCommand {
  constructor(
    public readonly tenantId: string,
    public readonly vehicleId: string,
    public readonly file: DocumentFilePayload
  ) {}
}

export class UploadVehiclePhotoCommand {
  constructor(
    public readonly tenantId: string,
    public readonly vehicleId: string,
    public readonly file: DocumentFilePayload
  ) {}
}

export class UploadVehicleInvoicePdfCommand {
  constructor(
    public readonly tenantId: string,
    public readonly vehicleId: string,
    public readonly file: DocumentFilePayload
  ) {}
}

export class UploadVehicleLrCopyCommand {
  constructor(
    public readonly tenantId: string,
    public readonly vehicleId: string,
    public readonly file: DocumentFilePayload
  ) {}
}

interface VehicleDetail {
  vehicle: VehicleDto;
  salesOrders: SalesOrderDto[];
  documents: DocumentDto[];
}

const toVehicleDto = (vehicle: any, role: UserRole): VehicleDto => {
  const legacyVehicle = vehicle as any;
  const dto: VehicleDto = {
    id: vehicle.id,
    tenantId: vehicle.tenantId,
    vehicleNumber: vehicle.vehicleNumber,
    driverName: vehicle.driverName ?? legacyVehicle.vehicleName ?? null,
    driverPhoneNumber:
      vehicle.driverPhoneNumber ?? legacyVehicle.driverPhone ?? null,
    asmPhoneNumber: vehicle.asmPhoneNumber ?? null,
    placedTruckSize: vehicle.placedTruckSize ?? legacyVehicle.truckSize ?? null,
    placedTruckType:
      (vehicle.placedTruckType as TruckType | null) ??
      (legacyVehicle.truckType as TruckType | null) ??
      null,
    loadType: (vehicle.loadType as LoadType | null) ?? null,
    vehicleAmount:
      vehicle.vehicleAmount ?? legacyVehicle.shippingAmount ?? null,
    vehicleExpense:
      vehicle.vehicleExpense ?? legacyVehicle.shippingExpense ?? null,
    location: vehicle.location,
    locationReachedAt: vehicle.locationReachedAt?.toISOString() ?? null,
    unloadedAt: vehicle.unloadedAt?.toISOString() ?? null,
    unloadedTime: vehicle.unloadedTime?.toISOString() ?? null,
    billedOn: vehicle.billedOn?.toISOString() ?? null,
    filledOn: vehicle.filledOn?.toISOString() ?? null,
    dbWaitingTimeHours: vehicle.dbWaitingTimeHours,
    loadingQuantity: vehicle.loadingQuantity ?? null,
    checkInAt: vehicle.checkInAt?.toISOString() ?? null,
    gateInAt: vehicle.gateInAt?.toISOString() ?? null,
    gateOutAt: vehicle.gateOutAt?.toISOString() ?? null,
    loadingStartedAt: vehicle.loadingStartedAt?.toISOString() ?? null,
    loadingCompletedAt: vehicle.loadingCompletedAt?.toISOString() ?? null,
    status: vehicle.status as VehicleStatus,
    invoiceStatus: vehicle.invoiceStatus as VehicleInvoiceStatus,
    isPaid: vehicle.isPaid,
    profit: vehicle.profit,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
  (dto as any).vehicleName = dto.driverName;
  (dto as any).driverPhone = dto.driverPhoneNumber;
  (dto as any).truckSize = dto.placedTruckSize;
  (dto as any).truckType = dto.placedTruckType;
  (dto as any).shippingAmount = dto.vehicleAmount;
  (dto as any).shippingExpense = dto.vehicleExpense;
  if (role === UserRole.LOGISTIC_WORKER) {
    dto.vehicleAmount = null;
    dto.vehicleExpense = null;
    dto.profit = null;
  } else if (role === UserRole.ACCOUNTANT) {
    dto.profit = null;
  }
  return dto;
};

const toVehicleSalesOrderDto = (order: any, role: UserRole): SalesOrderDto => {
  const legacyOrder = order as any;
  const soCases = order.soCases ?? legacyOrder.quantity ?? null;
  const townName =
    order.townName ?? legacyOrder.town ?? legacyOrder.townName ?? null;
  const pinCode =
    order.pinCode ?? legacyOrder.pincode ?? legacyOrder.pinCode ?? null;
  const requestedTruckSize =
    order.requestedTruckSize ??
    legacyOrder.truckSize ??
    legacyOrder.requestedTruckSize ??
    null;
  const partyAddress = order.partyAddress ?? null;
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
    soCases,
    quantity: soCases,
    caseLot: order.caseLot,
    requestedTruckSize,
    partyAddress,
    requestedTruckType:
      (order.requestedTruckType as TruckType | null) ??
      (legacyOrder.requestedTruckType as TruckType | null) ??
      null,
    placedTruckSize: order.placedTruckSize ?? null,
    placedTruckType: (order.placedTruckType as TruckType | null) ?? null,
    loadType: (order.loadType as LoadType | null) ?? null,
    status: order.status as SalesOrderStatus,
    previousStatus: (order.previousStatus as SalesOrderStatus | null) ?? null,
    finalAmount: order.finalAmount,
    createdFromImport: order.createdFromImport,
    fieldSource: order.fieldSource,
    loadingQuantity: order.loadingQuantity,
    tripReferenceNo: order.tripReferenceNo,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
  if (role === UserRole.LOGISTIC_WORKER) {
    dto.finalAmount = null;
  }
  return dto;
};

@CommandHandler(AssignVehicleCommand)
export class AssignVehicleHandler
  implements ICommandHandler<AssignVehicleCommand, VehicleDetail>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: AssignVehicleCommand): Promise<VehicleDetail> {
    const { tenantId } = command;
    const payload = { ...command.payload };
    if (!payload.salesOrderIds || payload.salesOrderIds.length === 0) {
      throw new BadRequestException("No sales orders provided");
    }
    const salesOrders = await this.prisma.salesOrder.findMany({
      where: { tenantId, id: { in: payload.salesOrderIds } },
    });
    if (salesOrders.length !== payload.salesOrderIds.length) {
      throw new BadRequestException("Some sales orders not found");
    }
    const frozenOrders = salesOrders.filter((order) =>
      isSalesOrderFrozen(order.status as SalesOrderStatus)
    );
    if (frozenOrders.length > 0) {
      const message = frozenOrders.map((order) => order.soNumber).join(", ");
      throw new BadRequestException(
        `Vehicle assignment is blocked for held or deleted sales orders: ${message}`
      );
    }
    const progressedOrders = salesOrders.filter((order) =>
      isAfterLoadingComplete(order.status as SalesOrderStatus)
    );
    if (progressedOrders.length > 0) {
      const message = progressedOrders
        .map((order) => order.soNumber)
        .join(", ");
      throw new BadRequestException(
        `Vehicle assignment is not allowed after LOADING_COMPLETE for: ${message}`
      );
    }
    const normalizedTripRef = (value?: string | number | null) => {
      if (value == null) return null;
      const stringValue = typeof value === "string" ? value : String(value);
      const trimmed = stringValue.trim();
      return trimmed || null;
    };
    const tripRefBuckets = salesOrders.reduce<Record<string, string[]>>(
      (acc, order) => {
        const key = normalizedTripRef(order.tripReferenceNo);
        if (!key) {
          return acc; // Ignore missing/empty trip references
        }
        acc[key] = acc[key] ? [...acc[key], order.soNumber] : [order.soNumber];
        return acc;
      },
      {}
    );
    const selectedTripRefs = Object.keys(tripRefBuckets);
    if (selectedTripRefs.length > 1) {
      const details = Object.entries(tripRefBuckets)
        .map(([ref, orders]) => `${ref}: ${orders.join(", ")}`)
        .join("; ");
      throw new BadRequestException(
        `Vehicle assignment requires all selected sales orders to share the same trip reference number. Found multiple references: ${details}`
      );
    }
    const existingLinks = await this.prisma.vehicleSalesOrder.findMany({
      where: { tenantId, salesOrderId: { in: payload.salesOrderIds } },
    });
    if (existingLinks.length > 0) {
      throw new BadRequestException(
        "One or more sales orders already assigned to vehicle"
      );
    }

    const ineligibleOrders = salesOrders
      .map((order) => ({
        soNumber: order.soNumber,
        missing: getMissingSalesOrderEligibilityFields(order as any),
      }))
      .filter((entry) => entry.missing.length > 0);
    if (ineligibleOrders.length > 0) {
      const message = ineligibleOrders
        .map(
          (entry) =>
            `SO ${entry.soNumber}: missing ${entry.missing
              .map((field) => String(field))
              .join(", ")}`
        )
        .join("; ");
      throw new BadRequestException(
        `Sales order(s) missing required fields for assignment: ${message}`
      );
    }

    const vehicleNumberInput = payload.vehicleNumber?.trim();
    const driverNameInput = (
      payload.driverName ??
      payload.vehicleName ??
      ""
    ).trim();
    const driverPhoneInput = (
      payload.driverPhoneNumber ??
      payload.driverPhone ??
      ""
    ).trim();
    const asmPhoneInput = payload.asmPhoneNumber?.trim() ?? null;
    const truckSizeInput = (
      payload.placedTruckSize ??
      payload.truckSize ??
      ""
    ).trim();
    const truckTypeInput = (payload.placedTruckType ?? payload.truckType) as
      | TruckType
      | undefined;
    const loadTypeInput = payload.loadType as LoadType | undefined;
    const vehicleAmountInput = payload.vehicleAmount ?? payload.shippingAmount;
    const vehicleExpenseInput =
      payload.vehicleExpense ??
      payload.shippingExpense ??
      vehicleAmountInput ??
      0;
    const locationInput = payload.location ?? null;

    let vehicleId = payload.vehicleId;
    let vehicle: any;

    await this.prisma.$transaction(async (tx) => {
      if (vehicleId) {
        vehicle = await tx.vehicle.findFirst({
          where: { id: vehicleId, tenantId },
        });
        if (!vehicle) {
          throw new BadRequestException("Vehicle not found");
        }
        const existingVehicleLinks = await tx.vehicleSalesOrder.findMany({
          where: { tenantId, vehicleId },
          include: { salesOrder: true },
        });
        const existingTripRefs = existingVehicleLinks
          .map((link) => normalizedTripRef(link.salesOrder?.tripReferenceNo))
          .filter((ref): ref is string => !!ref);
        const uniqueExistingRefs = Array.from(new Set(existingTripRefs));
        if (uniqueExistingRefs.length > 1) {
          throw new BadRequestException(
            `Vehicle has conflicting trip reference numbers already assigned: ${uniqueExistingRefs.join(
              ", "
            )}`
          );
        }
        if (uniqueExistingRefs.length === 1) {
          const existingRef = uniqueExistingRefs[0];
          const conflictingSelected = selectedTripRefs.filter(
            (ref) => ref !== existingRef
          );
          if (conflictingSelected.length > 0) {
            throw new BadRequestException(
              `Vehicle already has trip reference number ${existingRef}. Selected sales orders include different reference(s): ${conflictingSelected.join(
                ", "
              )}`
            );
          }
        }
        const legacyVehicle = vehicle as any;
        const resolvedDriverName =
          driverNameInput || vehicle.driverName || legacyVehicle.vehicleName;
        const resolvedDriverPhone =
          driverPhoneInput ||
          vehicle.driverPhoneNumber ||
          legacyVehicle.driverPhone ||
          null;
        const resolvedAsmPhone =
          asmPhoneInput ?? vehicle.asmPhoneNumber ?? null;
        const resolvedTruckSize =
          truckSizeInput ||
          vehicle.placedTruckSize ||
          legacyVehicle.truckSize ||
          null;
        const resolvedTruckType =
          truckTypeInput ??
          (vehicle.placedTruckType as TruckType | null) ??
          (legacyVehicle.truckType as TruckType | null) ??
          null;
        const resolvedVehicleAmount =
          vehicleAmountInput ??
          vehicle.vehicleAmount ??
          legacyVehicle.shippingAmount ??
          vehicle.vehicleExpense ??
          0;
        const resolvedVehicleExpense =
          vehicleExpenseInput ??
          vehicle.vehicleExpense ??
          legacyVehicle.shippingExpense ??
          resolvedVehicleAmount;
        if (
          !resolvedDriverName ||
          !resolvedDriverPhone ||
          !resolvedTruckSize ||
          !resolvedTruckType ||
          resolvedVehicleAmount == null
        ) {
          throw new BadRequestException(
            "Vehicle record missing mandatory driver or vehicle details"
          );
        }
        const profit = resolvedVehicleAmount - resolvedVehicleExpense;
        vehicle = await tx.vehicle.update({
          where: { id: vehicle.id },
          data: {
            driverName: resolvedDriverName,
            driverPhoneNumber: resolvedDriverPhone,
            asmPhoneNumber: resolvedAsmPhone,
            placedTruckSize: resolvedTruckSize,
            placedTruckType: (resolvedTruckType ??
              null) as $Enums.TruckType | null,
            loadType: loadTypeInput ?? vehicle.loadType,
            vehicleAmount: resolvedVehicleAmount,
            vehicleExpense: resolvedVehicleExpense,
            location: locationInput ?? vehicle.location,
            status: VehicleStatus.ASSIGNED,
            profit,
          } as any,
        });
      } else {
        if (
          !vehicleNumberInput ||
          !driverNameInput ||
          !driverPhoneInput ||
          !truckSizeInput ||
          !truckTypeInput ||
          vehicleAmountInput == null
        ) {
          throw new BadRequestException(
            "vehicleNumber required when creating new vehicle"
          );
        }
        const vehicleAmount = vehicleAmountInput;
        const vehicleExpense = vehicleExpenseInput ?? vehicleAmount;
        const profit = vehicleAmount - vehicleExpense;
        vehicle = await tx.vehicle.create({
          data: {
            tenantId,
            vehicleNumber: vehicleNumberInput,
            driverName: driverNameInput,
            driverPhoneNumber: driverPhoneInput,
            asmPhoneNumber: asmPhoneInput,
            placedTruckSize: truckSizeInput as $Enums.TruckSize | null,
            placedTruckType: (truckTypeInput ??
              null) as $Enums.TruckType | null,
            loadType: loadTypeInput ?? null,
            vehicleAmount,
            vehicleExpense,
            location: locationInput,
            status: VehicleStatus.ASSIGNED,
            invoiceStatus: VehicleInvoiceStatus.NONE,
            profit,
          } as any,
        });
        vehicleId = vehicle.id;
      }

      await tx.vehicleSalesOrder.createMany({
        data: payload.salesOrderIds.map((id) => ({
          tenantId,
          vehicleId: vehicleId!,
          salesOrderId: id,
        })),
      });
      for (const order of salesOrders) {
        const nextStatus = SalesOrderStatus.VEHICLE_ASSIGNED;
        assertForwardSalesOrderStatus(
          order.status as SalesOrderStatus,
          nextStatus
        );
        await tx.salesOrder.update({
          where: { id: order.id },
          data: { status: nextStatus },
        });
      }
    });

    const detail = await this.buildVehicleDetail(
      vehicle.id,
      tenantId,
      command.userRole
    );
    return detail;
  }

  private async buildVehicleDetail(
    vehicleId: string,
    tenantId: string,
    role: UserRole
  ): Promise<VehicleDetail> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });
    const links = await this.prisma.vehicleSalesOrder.findMany({
      where: { tenantId, vehicleId },
      include: { salesOrder: true },
    });
    const documents = await this.prisma.vehicleDocument.findMany({
      where: { tenantId, vehicleId },
      include: { document: true },
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found after assignment");
    }
    return {
      vehicle: toVehicleDto(vehicle, role),
      salesOrders: links.map((l) => toVehicleSalesOrderDto(l.salesOrder, role)),
      documents: documents.map((doc) => this.mapDocument(doc.document)),
    };
  }

  private mapDocument(document: any): DocumentDto {
    return {
      id: document.id,
      tenantId: document.tenantId,
      type: document.type as DocumentType,
      fileName: document.fileName,
      mimeType: document.mimeType,
      storagePath: document.storagePath ?? undefined,
      viewerUrl: `/documents/${document.id}`,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(ListVehiclesQuery)
export class ListVehiclesHandler
  implements IQueryHandler<ListVehiclesQuery, PaginatedResult<VehicleDto>>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ListVehiclesQuery
  ): Promise<PaginatedResult<VehicleDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === "desc" ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.VehicleOrderByWithRelationInput = query.sortBy
      ? ({
          [query.sortBy]: direction,
        } as Prisma.VehicleOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const [totalCount, vehicles] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
      }),
    ]);
    const data = vehicles.map((vehicle) => toVehicleDto(vehicle, query.role));
    return { data, page, pageSize, totalCount };
  }

  private buildWhere(tenantId: string, filters: Record<string, string>) {
    const where: any = { tenantId };
    if (!filters) return where;

    // Handle nested filters object (in case it wasn't flattened in the controller)
    let processedFilters: Record<string, string> = filters;
    if (
      filters.filters &&
      typeof filters.filters === "object" &&
      !Array.isArray(filters.filters)
    ) {
      processedFilters = { ...(filters.filters as Record<string, string>) };
    }

    Object.entries(processedFilters).forEach(([key, value]) => {
      if (!value || key === "filters") return;
      const fieldKey = this.resolveFilterField(key);
      switch (key) {
        case "status":
        case "invoiceStatus":
          where[key] = value.includes(",") ? { in: value.split(",") } : value;
          break;
        case "vehicleNumber":
        case "driverPhone":
          where[fieldKey] = { contains: value, mode: "insensitive" };
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
          where[fieldKey] = value;
      }
    });
    return where;
  }

  private resolveFilterField(key: string) {
    const remap: Record<string, string> = {
      driverPhone: "driverPhoneNumber",
      vehicleName: "driverName",
      truckSize: "placedTruckSize",
    };
    return remap[key] ?? key;
  }
}

@QueryHandler(GetVehicleQuery)
export class GetVehicleHandler
  implements IQueryHandler<GetVehicleQuery, VehicleDetail>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetVehicleQuery): Promise<VehicleDetail> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
    const orders = await this.prisma.vehicleSalesOrder.findMany({
      where: { tenantId: query.tenantId, vehicleId: vehicle.id },
      include: { salesOrder: true },
    });
    const docs = await this.prisma.vehicleDocument.findMany({
      where: { tenantId: query.tenantId, vehicleId: vehicle.id },
      include: { document: true },
    });
    return {
      vehicle: toVehicleDto(vehicle, query.role),
      salesOrders: orders.map((o) =>
        toVehicleSalesOrderDto(o.salesOrder, query.role)
      ),
      documents: docs.map((doc) => this.mapDocument(doc.document)),
    };
  }

  private mapDocument(document: any): DocumentDto {
    return {
      id: document.id,
      tenantId: document.tenantId,
      type: document.type as DocumentType,
      fileName: document.fileName,
      mimeType: document.mimeType,
      storagePath: document.storagePath ?? undefined,
      viewerUrl: `/documents/${document.id}`,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

@CommandHandler(UpdateVehicleCommand)
export class UpdateVehicleHandler
  implements ICommandHandler<UpdateVehicleCommand, VehicleDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateVehicleCommand): Promise<VehicleDto> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: command.id, tenantId: command.tenantId },
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
    const updates: Record<string, any> = {};
    let requestedStatus: VehicleStatus | undefined;
    Object.entries(command.payload).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      // Block certain fields from being updated by LOGISTIC_WORKER
      const restrictedFields = [
        "vehicleAmount",
        "vehicleExpense",
        "shippingAmount",
        "shippingExpense",
        "isPaid",
        "invoiceStatus",
        "vehicleNumber", // Vehicle number should not be changed after creation
      ];
      if (
        command.role === UserRole.LOGISTIC_WORKER &&
        restrictedFields.includes(key)
      ) {
        return;
      }

      // Block vehicleNumber updates for all roles (should be immutable)
      if (key === "vehicleNumber") {
        return;
      }

      const targetKey = this.resolveUpdateField(key);

      // Handle status updates with validation
      if (targetKey === "status") {
        const requested = value as VehicleStatus;
        assertForwardVehicleStatus(vehicle.status as VehicleStatus, requested);
        // Require loadingQuantity when status is LOADING_COMPLETE
        if (requested === VehicleStatus.LOADING_COMPLETE) {
          // Check payload first, then updates, then existing vehicle value
          const loadingQtyFromPayload = command.payload.loadingQuantity;
          const loadingQty =
            loadingQtyFromPayload ??
            updates.loadingQuantity ??
            vehicle.loadingQuantity;
          if (!loadingQty || loadingQty <= 0) {
            throw new BadRequestException(
              "LoadingQuantity is required when status is LOADING_COMPLETE"
            );
          }
        }
        updates.status = requested;
        requestedStatus = requested;
        return;
      }

      // Handle date fields
      if (
        ["locationReachedAt", "unloadedAt", "billedOn", "filledOn"].includes(
          targetKey
        ) &&
        value
      ) {
        updates[targetKey] = new Date(value as string);
      } else {
        updates[targetKey] = value;
      }
    });
    if (requestedStatus === VehicleStatus.TRIP_INVOICED) {
      await this.ensureTripInvoicedDocuments(command.tenantId, vehicle.id);
    }
    const legacyVehicle = vehicle as any;
    const vehicleAmount =
      updates.vehicleAmount ??
      updates.shippingAmount ??
      vehicle.vehicleAmount ??
      legacyVehicle.shippingAmount ??
      0;
    const vehicleExpense =
      updates.vehicleExpense ??
      updates.shippingExpense ??
      vehicle.vehicleExpense ??
      legacyVehicle.shippingExpense ??
      0;
    updates.vehicleAmount = vehicleAmount;
    updates.vehicleExpense = vehicleExpense;
    updates.profit = vehicleAmount - vehicleExpense;
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedVehicle = await tx.vehicle.update({
        where: { id: vehicle.id },
        data: updates,
      });
      // Sync SO status if vehicle status changed
      if (updates.status) {
        const { syncSalesOrderStatusFromVehicle } = await import(
          "../../domain/common/status.rules"
        );
        await syncSalesOrderStatusFromVehicle(
          tx,
          command.tenantId,
          vehicle.id,
          updates.status as VehicleStatus
        );
      }
      return updatedVehicle;
    });
    return toVehicleDto(updated, command.role);
  }

  private async ensureTripInvoicedDocuments(
    tenantId: string,
    vehicleId: string
  ) {
    const documents = await this.prisma.vehicleDocument.findMany({
      where: {
        tenantId,
        vehicleId,
        document: {
          type: { in: [DocumentType.LR_COPY, DocumentType.INVOICE_PDF] },
        },
      },
      include: { document: true },
    });
    const hasLrCopy = documents.some(
      (doc) => doc.document.type === DocumentType.LR_COPY
    );
    const hasInvoicePdf = documents.some(
      (doc) => doc.document.type === DocumentType.INVOICE_PDF
    );
    if (!hasLrCopy || !hasInvoicePdf) {
      throw new BadRequestException(
        "LR copy and Invoice PDF are required before marking vehicle as TRIP_INVOICED"
      );
    }
  }

  private resolveUpdateField(key: string) {
    // Map legacy field names to new field names
    const legacyMap: Record<string, string> = {
      shippingAmount: "vehicleAmount",
      shippingExpense: "vehicleExpense",
      vehicleName: "driverName",
      driverPhone: "driverPhoneNumber",
      truckSize: "placedTruckSize",
      truckType: "placedTruckType",
    };
    // If it's already a new field name, return as-is; otherwise map from legacy
    return legacyMap[key] ?? key;
  }
}

@QueryHandler(ExportVehiclesQuery)
export class ExportVehiclesHandler
  implements
    IQueryHandler<ExportVehiclesQuery, { fileName: string; buffer: Buffer }>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ExportVehiclesQuery
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === "desc" ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: Prisma.VehicleOrderByWithRelationInput = query.sortBy
      ? ({
          [query.sortBy]: direction,
        } as Prisma.VehicleOrderByWithRelationInput)
      : { createdAt: Prisma.SortOrder.desc };
    const vehicles = await this.prisma.vehicle.findMany({
      where,
      orderBy,
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Vehicles");
    sheet.columns = [
      { header: "Vehicle Number", key: "vehicleNumber", width: 20 },
      { header: "Driver Name", key: "driverName", width: 20 },
      { header: "Driver Phone", key: "driverPhoneNumber", width: 20 },
      { header: "Placed Truck Size", key: "placedTruckSize", width: 18 },
      { header: "Placed Truck Type", key: "placedTruckType", width: 18 },
      { header: "Load Type", key: "loadType", width: 15 },
      { header: "Vehicle Amount", key: "vehicleAmount", width: 18 },
      { header: "Vehicle Expense", key: "vehicleExpense", width: 18 },
      { header: "Profit", key: "profit", width: 12 },
      { header: "Status", key: "status", width: 15 },
      { header: "Invoice Status", key: "invoiceStatus", width: 20 },
    ];
    vehicles.forEach((vehicle) => {
      const legacyVehicle = vehicle as any;
      sheet.addRow({
        vehicleNumber: vehicle.vehicleNumber,
        driverName: vehicle.driverName ?? legacyVehicle.vehicleName ?? "",
        driverPhoneNumber:
          vehicle.driverPhoneNumber ?? legacyVehicle.driverPhone ?? "",
        placedTruckSize:
          vehicle.placedTruckSize ?? legacyVehicle.truckSize ?? "",
        placedTruckType:
          vehicle.placedTruckType ?? legacyVehicle.truckType ?? "",
        loadType: vehicle.loadType,
        vehicleAmount:
          query.role === UserRole.LOGISTIC_WORKER
            ? ""
            : vehicle.vehicleAmount ?? legacyVehicle.shippingAmount ?? "",
        vehicleExpense:
          query.role === UserRole.LOGISTIC_WORKER
            ? ""
            : vehicle.vehicleExpense ?? legacyVehicle.shippingExpense ?? "",
        profit:
          query.role === UserRole.LOGISTIC_WORKER ||
          query.role === UserRole.ACCOUNTANT
            ? ""
            : vehicle.profit ?? "",
        status: vehicle.status,
        invoiceStatus: vehicle.invoiceStatus,
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: `vehicles-${new Date().toISOString()}.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  private buildWhere(tenantId: string, filters: Record<string, string>) {
    const where: any = { tenantId };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (!value) return;
      const fieldKey = this.resolveFilterField(key);
      switch (key) {
        case "status":
        case "invoiceStatus":
          where[key] = value.includes(",") ? { in: value.split(",") } : value;
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
          where[fieldKey] = { contains: value, mode: "insensitive" };
      }
    });
    return where;
  }

  private resolveFilterField(key: string) {
    const remap: Record<string, string> = {
      vehicleName: "driverName",
      driverPhone: "driverPhoneNumber",
      truckSize: "placedTruckSize",
      truckType: "placedTruckType",
    };
    return remap[key] ?? key;
  }
}

@CommandHandler(UploadVehiclePodCommand)
export class UploadVehiclePodHandler
  implements ICommandHandler<UploadVehiclePodCommand, DocumentDto>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentManager: DocumentManager
  ) {}

  async execute(command: UploadVehiclePodCommand): Promise<DocumentDto> {
    await this.ensureVehicle(command.tenantId, command.vehicleId);
    const document = await this.documentManager.createDocument(
      command.tenantId,
      DocumentType.POD,
      command.file
    );
    await this.prisma.vehicleDocument.create({
      data: {
        tenantId: command.tenantId,
        vehicleId: command.vehicleId,
        documentId: document.id,
      },
    });
    return this.mapDocument(document);
  }

  private async ensureVehicle(tenantId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
  }

  private mapDocument(document: any): DocumentDto {
    return {
      id: document.id,
      tenantId: document.tenantId,
      type: document.type as DocumentType,
      fileName: document.fileName,
      mimeType: document.mimeType,
      storagePath: document.storagePath ?? undefined,
      viewerUrl: `/documents/${document.id}`,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

@CommandHandler(UploadVehiclePhotoCommand)
export class UploadVehiclePhotoHandler
  implements ICommandHandler<UploadVehiclePhotoCommand, DocumentDto>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentManager: DocumentManager
  ) {}

  async execute(command: UploadVehiclePhotoCommand): Promise<DocumentDto> {
    await this.ensureVehicle(command.tenantId, command.vehicleId);
    const document = await this.documentManager.createDocument(
      command.tenantId,
      DocumentType.VEHICLE_PHOTO,
      command.file
    );
    await this.prisma.vehicleDocument.create({
      data: {
        tenantId: command.tenantId,
        vehicleId: command.vehicleId,
        documentId: document.id,
      },
    });
    return this.mapDocument(document);
  }

  private async ensureVehicle(tenantId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
  }

  private mapDocument(document: any): DocumentDto {
    return {
      id: document.id,
      tenantId: document.tenantId,
      type: document.type as DocumentType,
      fileName: document.fileName,
      mimeType: document.mimeType,
      storagePath: document.storagePath ?? undefined,
      viewerUrl: `/documents/${document.id}`,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

@CommandHandler(UploadVehicleInvoicePdfCommand)
export class UploadVehicleInvoicePdfHandler
  implements ICommandHandler<UploadVehicleInvoicePdfCommand, DocumentDto>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentManager: DocumentManager
  ) {}

  async execute(command: UploadVehicleInvoicePdfCommand): Promise<DocumentDto> {
    await this.ensureVehicle(command.tenantId, command.vehicleId);
    const document = await this.documentManager.createDocument(
      command.tenantId,
      DocumentType.INVOICE_PDF,
      command.file
    );
    await this.prisma.vehicleDocument.create({
      data: {
        tenantId: command.tenantId,
        vehicleId: command.vehicleId,
        documentId: document.id,
      },
    });
    return this.mapDocument(document);
  }

  private async ensureVehicle(tenantId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
  }

  private mapDocument(document: any): DocumentDto {
    return {
      id: document.id,
      tenantId: document.tenantId,
      type: document.type as DocumentType,
      fileName: document.fileName,
      mimeType: document.mimeType,
      storagePath: document.storagePath ?? undefined,
      viewerUrl: `/documents/${document.id}`,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

@CommandHandler(UploadVehicleLrCopyCommand)
export class UploadVehicleLrCopyHandler
  implements ICommandHandler<UploadVehicleLrCopyCommand, DocumentDto>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentManager: DocumentManager
  ) {}

  async execute(command: UploadVehicleLrCopyCommand): Promise<DocumentDto> {
    await this.ensureVehicle(command.tenantId, command.vehicleId);
    const document = await this.documentManager.createDocument(
      command.tenantId,
      DocumentType.LR_COPY,
      command.file
    );
    await this.prisma.vehicleDocument.create({
      data: {
        tenantId: command.tenantId,
        vehicleId: command.vehicleId,
        documentId: document.id,
      },
    });
    return this.mapDocument(document);
  }

  private async ensureVehicle(tenantId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }
  }

  private mapDocument(document: any): DocumentDto {
    return {
      id: document.id,
      tenantId: document.tenantId,
      type: document.type as DocumentType,
      fileName: document.fileName,
      mimeType: document.mimeType,
      storagePath: document.storagePath ?? undefined,
      viewerUrl: `/documents/${document.id}`,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

@QueryHandler(SearchVehiclesQuery)
export class SearchVehiclesHandler
  implements IQueryHandler<SearchVehiclesQuery, VehicleDto[]>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: SearchVehiclesQuery): Promise<VehicleDto[]> {
    if (!query.searchTerm || query.searchTerm.trim().length < 2) {
      return [];
    }

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        tenantId: query.tenantId,
        vehicleNumber: {
          contains: query.searchTerm.trim(),
          mode: "insensitive",
        },
      },
      take: 10, // Limit to 10 suggestions
      orderBy: { vehicleNumber: "asc" },
    });

    return vehicles.map((vehicle) => toVehicleDto(vehicle, UserRole.ADMIN));
  }
}

export const VehicleHandlers = [
  AssignVehicleHandler,
  ListVehiclesHandler,
  GetVehicleHandler,
  UpdateVehicleHandler,
  SearchVehiclesHandler,
  ExportVehiclesHandler,
  UploadVehiclePodHandler,
  UploadVehiclePhotoHandler,
  UploadVehicleInvoicePdfHandler,
  UploadVehicleLrCopyHandler,
];
