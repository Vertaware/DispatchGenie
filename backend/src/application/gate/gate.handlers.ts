import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from '@nestjs/cqrs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  AuthenticatedUser,
  GateDto,
  GateStatus,
  LoadType,
  PaginatedResult,
  SalesOrderDto,
  SalesOrderStatus,
  TruckType,
  UserRole,
  VehicleStatus,
} from '~/enums/index';
import {
  assertForwardSalesOrderStatus,
  assertForwardVehicleStatus,
  syncSalesOrderStatusFromVehicle,
} from '../../domain/common/status.rules';
import { Prisma } from '@prisma/client';

type SortOrder = 'asc' | 'desc';

const mapGateSalesOrder = (order: any): SalesOrderDto | null => {
  if (!order) {
    return null;
  }
  const legacyOrder = order as any;
  const soCases = order.soCases ?? legacyOrder.quantity ?? null;
  const townName = order.townName ?? legacyOrder.town ?? legacyOrder.townName ?? null;
  const pinCode = order.pinCode ?? legacyOrder.pincode ?? legacyOrder.pinCode ?? null;
  const requestedTruckSize =
    order.requestedTruckSize ?? legacyOrder.truckSize ?? legacyOrder.requestedTruckSize ?? null;
  const partyAddress = order.partyAddress ?? null;
  return {
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
    category: order.category,
    partyAddress,
    status: order.status,
    finalAmount: order.finalAmount,
    loadingQuantity: order.loadingQuantity,
    createdFromImport: order.createdFromImport,
    fieldSource: order.fieldSource as any,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    requestedTruckType:
      (order.requestedTruckType as TruckType | null) ??
      (legacyOrder.requestedTruckType as TruckType | null) ??
      null,
    placedTruckSize: order.placedTruckSize ?? null,
    placedTruckType: (order.placedTruckType as TruckType | null) ?? null,
    loadType: (order.loadType as LoadType | null) ?? null,
  };
};

export class ListGateVehiclesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly sortBy: string | undefined,
    public readonly sortOrder: SortOrder | undefined,
    public readonly filters: Record<string, string>,
  ) {}
}

export class GateInVehicleCommand {
  constructor(
    public readonly tenantId: string,
    public readonly gateId: string,
  ) {}
}

export class GateOutVehicleCommand {
  constructor(
    public readonly tenantId: string,
    public readonly gateId: string,
  ) {}
}

export class UpdateGateVehicleCommand {
  constructor(
    public readonly tenantId: string,
    public readonly gateId: string,
    public readonly payload: Record<string, any>,
  ) {}
}

export class DeleteGateVehicleCommand {
  constructor(
    public readonly tenantId: string,
    public readonly gateId: string,
  ) {}
}

export class CheckInVehicleCommand {
  constructor(
    public readonly tenantId: string,
    public readonly vehicleNumber: string,
  ) {}
}

@QueryHandler(ListGateVehiclesQuery)
export class ListGateVehiclesHandler
  implements IQueryHandler<ListGateVehiclesQuery, PaginatedResult<GateDto>>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListGateVehiclesQuery): Promise<PaginatedResult<GateDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = this.buildWhere(query.tenantId, query.filters);
    const direction: Prisma.SortOrder =
      query.sortOrder === 'desc' ? Prisma.SortOrder.desc : Prisma.SortOrder.asc;
    const orderBy: any = query.sortBy
      ? { [query.sortBy]: direction }
      : { createdAt: Prisma.SortOrder.desc };

    const [totalCount, gates] = await this.prisma.$transaction([
      (this.prisma as any).gate.count({ where }),
      (this.prisma as any).gate.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          vehicle: true,
          salesOrder: true,
        },
      }),
    ]);

    const data = gates.map((gate: any) => this.mapGate(gate));
    return { data, page, pageSize, totalCount };
  }

  private buildWhere(tenantId: string, filters: Record<string, string>) {
    const where: any = {
      tenantId,
      // Only show active gate entries (not cancelled or gate-out)
      status: {
        notIn: [GateStatus.CANCELLED, GateStatus.GATE_OUT],
      },
    };
    if (!filters) return where;
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      switch (key) {
        case 'vehicleNumber':
          where.vehicleNumber = { contains: value, mode: 'insensitive' };
          break;
        case 'status':
          where.status = value;
          break;
        case 'fromDate':
        case 'toDate':
          where.checkInAt = where.checkInAt ?? {};
          if (key === 'fromDate') {
            where.checkInAt.gte = new Date(String(value));
          } else {
            where.checkInAt.lte = new Date(String(value));
          }
          break;
        default:
          break;
      }
    });
    return where;
  }

  private mapGate(gate: any): GateDto {
    return {
      id: gate.id,
      tenantId: gate.tenantId,
      vehicleId: gate.vehicleId,
      vehicleNumber: gate.vehicleNumber,
      salesOrderId: gate.salesOrderId,
      soNumber: gate.salesOrder?.soNumber ?? null,
      status: gate.status as GateStatus,
      checkInAt: gate.checkInAt.toISOString(),
      gateInAt: gate.gateInAt?.toISOString() ?? null,
      gateOutAt: gate.gateOutAt?.toISOString() ?? null,
      notes: gate.notes ?? null,
      createdAt: gate.createdAt.toISOString(),
      updatedAt: gate.updatedAt.toISOString(),
      vehicle: gate.vehicle
        ? {
            id: gate.vehicle.id,
            tenantId: gate.vehicle.tenantId,
            vehicleNumber: gate.vehicle.vehicleNumber,
            driverName: gate.vehicle.driverName ?? null,
            driverPhoneNumber: gate.vehicle.driverPhoneNumber ?? null,
            placedTruckSize: gate.vehicle.placedTruckSize ?? null,
            placedTruckType: gate.vehicle.placedTruckType ?? null,
            loadType: gate.vehicle.loadType ?? null,
            vehicleAmount: gate.vehicle.vehicleAmount ?? null,
            vehicleExpense: gate.vehicle.vehicleExpense ?? null,
            location: gate.vehicle.location,
            locationReachedAt: gate.vehicle.locationReachedAt?.toISOString() ?? null,
            unloadedAt: gate.vehicle.unloadedAt?.toISOString() ?? null,
            billedOn: gate.vehicle.billedOn?.toISOString() ?? null,
            filledOn: gate.vehicle.filledOn?.toISOString() ?? null,
            dbWaitingTimeHours: gate.vehicle.dbWaitingTimeHours,
            loadingQuantity: gate.vehicle.loadingQuantity ?? null,
            checkInAt: gate.vehicle.checkInAt?.toISOString() ?? null,
            gateInAt: gate.vehicle.gateInAt?.toISOString() ?? null,
            gateOutAt: gate.vehicle.gateOutAt?.toISOString() ?? null,
            loadingStartedAt: gate.vehicle.loadingStartedAt?.toISOString() ?? null,
            loadingCompletedAt: gate.vehicle.loadingCompletedAt?.toISOString() ?? null,
            status: gate.vehicle.status as VehicleStatus,
            invoiceStatus: gate.vehicle.invoiceStatus,
            isPaid: gate.vehicle.isPaid,
            profit: gate.vehicle.profit,
            createdAt: gate.vehicle.createdAt.toISOString(),
            updatedAt: gate.vehicle.updatedAt.toISOString(),
          }
        : null,
      salesOrder: mapGateSalesOrder(gate.salesOrder),
    };
  }
}

@CommandHandler(GateInVehicleCommand)
export class GateInVehicleHandler
  implements ICommandHandler<GateInVehicleCommand, GateDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: GateInVehicleCommand): Promise<GateDto> {
    const gate = await (this.prisma as any).gate.findFirst({
      where: { id: command.gateId, tenantId: command.tenantId },
      include: { vehicle: true, salesOrder: true },
    });
    if (!gate) {
      throw new NotFoundException('Gate entry not found');
    }

    if (gate.status !== GateStatus.CHECK_IN) {
      throw new BadRequestException('Gate entry must be in CHECK_IN status to perform Gate-In');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedGate = await (tx as any).gate.update({
        where: { id: gate.id },
        data: {
          status: GateStatus.GATE_IN,
          gateInAt: new Date(),
        },
        include: { vehicle: true, salesOrder: true },
      });

      // Update vehicle status if linked
      if (gate.vehicleId) {
        const vehicle = await tx.vehicle.findFirst({
          where: { id: gate.vehicleId },
        });
        if (vehicle) {
          const currentStatus = vehicle.status as VehicleStatus;
          const targetStatus = VehicleStatus.GATE_IN;
          try {
            assertForwardVehicleStatus(currentStatus, targetStatus);
            await tx.vehicle.update({
              where: { id: vehicle.id },
              data: {
                status: targetStatus,
                gateInAt: new Date(),
              },
            });
            // Sync linked SO statuses
            await syncSalesOrderStatusFromVehicle(tx, command.tenantId, vehicle.id, targetStatus);
          } catch (error) {
            // Status transition invalid, skip vehicle update
          }
        }
      }

      return updatedGate;
    });

    return this.mapGate(updated);
  }

  private mapGate(gate: any): GateDto {
    return {
      id: gate.id,
      tenantId: gate.tenantId,
      vehicleId: gate.vehicleId,
      vehicleNumber: gate.vehicleNumber,
      salesOrderId: gate.salesOrderId,
      soNumber: gate.salesOrder?.soNumber ?? null,
      status: gate.status as GateStatus,
      checkInAt: gate.checkInAt.toISOString(),
      gateInAt: gate.gateInAt?.toISOString() ?? null,
      gateOutAt: gate.gateOutAt?.toISOString() ?? null,
      notes: gate.notes ?? null,
      createdAt: gate.createdAt.toISOString(),
      updatedAt: gate.updatedAt.toISOString(),
      vehicle: gate.vehicle
        ? {
            id: gate.vehicle.id,
            tenantId: gate.vehicle.tenantId,
            vehicleNumber: gate.vehicle.vehicleNumber,
            driverName: gate.vehicle.driverName ?? null,
            driverPhoneNumber: gate.vehicle.driverPhoneNumber ?? null,
            placedTruckSize: gate.vehicle.placedTruckSize ?? null,
            placedTruckType: gate.vehicle.placedTruckType ?? null,
            loadType: gate.vehicle.loadType ?? null,
            vehicleAmount: gate.vehicle.vehicleAmount ?? null,
            vehicleExpense: gate.vehicle.vehicleExpense ?? null,
            location: gate.vehicle.location,
            locationReachedAt: gate.vehicle.locationReachedAt?.toISOString() ?? null,
            unloadedAt: gate.vehicle.unloadedAt?.toISOString() ?? null,
            billedOn: gate.vehicle.billedOn?.toISOString() ?? null,
            filledOn: gate.vehicle.filledOn?.toISOString() ?? null,
            dbWaitingTimeHours: gate.vehicle.dbWaitingTimeHours,
            loadingQuantity: gate.vehicle.loadingQuantity ?? null,
            checkInAt: gate.vehicle.checkInAt?.toISOString() ?? null,
            gateInAt: gate.vehicle.gateInAt?.toISOString() ?? null,
            gateOutAt: gate.vehicle.gateOutAt?.toISOString() ?? null,
            loadingStartedAt: gate.vehicle.loadingStartedAt?.toISOString() ?? null,
            loadingCompletedAt: gate.vehicle.loadingCompletedAt?.toISOString() ?? null,
            status: gate.vehicle.status as VehicleStatus,
            invoiceStatus: gate.vehicle.invoiceStatus,
            isPaid: gate.vehicle.isPaid,
            profit: gate.vehicle.profit,
            createdAt: gate.vehicle.createdAt.toISOString(),
            updatedAt: gate.vehicle.updatedAt.toISOString(),
          }
        : null,
      salesOrder: mapGateSalesOrder(gate.salesOrder),
    };
  }
}

@CommandHandler(GateOutVehicleCommand)
export class GateOutVehicleHandler
  implements ICommandHandler<GateOutVehicleCommand, GateDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: GateOutVehicleCommand): Promise<GateDto> {
    const targetVehicleStatus = VehicleStatus.IN_JOURNEY;
    const targetSalesOrderStatus = SalesOrderStatus.IN_JOURNEY;
    const now = new Date();

    const gate = await (this.prisma as any).gate.findFirst({
      where: { id: command.gateId, tenantId: command.tenantId },
      include: { vehicle: true, salesOrder: true },
    });
    if (!gate) {
      throw new NotFoundException('Gate entry not found');
    }

    if (gate.status !== GateStatus.GATE_IN) {
      throw new BadRequestException('Gate entry must be in GATE_IN status to perform Gate-Out');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedGate = await (tx as any).gate.update({
        where: { id: gate.id },
        data: {
          status: GateStatus.GATE_OUT,
          gateOutAt: now,
        },
        include: { vehicle: true, salesOrder: true },
      });

      // Update vehicle status if linked
      if (gate.vehicleId) {
        const vehicle = await tx.vehicle.findFirst({
          where: { id: gate.vehicleId },
        });
        if (vehicle) {
          const currentStatus = vehicle.status as VehicleStatus;
          try {
            assertForwardVehicleStatus(currentStatus, targetVehicleStatus);
            await tx.vehicle.update({
              where: { id: vehicle.id },
              data: {
                status: targetVehicleStatus,
                gateOutAt: now,
              },
            });
            // Sync linked SO statuses
            await syncSalesOrderStatusFromVehicle(
              tx,
              command.tenantId,
              vehicle.id,
              targetVehicleStatus,
            );
          } catch (error) {
            // Status transition invalid, skip vehicle update
          }
        }
      }

      // Ensure linked Sales Order moves to In Journey even if vehicle sync fails or is absent
      if (gate.salesOrderId) {
        const salesOrder = await tx.salesOrder.findFirst({
          where: { id: gate.salesOrderId, tenantId: command.tenantId },
        });
        if (salesOrder) {
          const currentSoStatus = salesOrder.status as SalesOrderStatus;
          try {
            assertForwardSalesOrderStatus(currentSoStatus, targetSalesOrderStatus);
            await tx.salesOrder.update({
              where: { id: salesOrder.id },
              data: { status: targetSalesOrderStatus },
            });
          } catch (error) {
            // SO already ahead or frozen; leave as-is
          }
        }
      }

      return updatedGate;
    });

    return this.mapGate(updated);
  }

  private mapGate(gate: any): GateDto {
    return {
      id: gate.id,
      tenantId: gate.tenantId,
      vehicleId: gate.vehicleId,
      vehicleNumber: gate.vehicleNumber,
      salesOrderId: gate.salesOrderId,
      soNumber: gate.salesOrder?.soNumber ?? null,
      status: gate.status as GateStatus,
      checkInAt: gate.checkInAt.toISOString(),
      gateInAt: gate.gateInAt?.toISOString() ?? null,
      gateOutAt: gate.gateOutAt?.toISOString() ?? null,
      notes: gate.notes ?? null,
      createdAt: gate.createdAt.toISOString(),
      updatedAt: gate.updatedAt.toISOString(),
      vehicle: gate.vehicle
        ? {
            id: gate.vehicle.id,
            tenantId: gate.vehicle.tenantId,
            vehicleNumber: gate.vehicle.vehicleNumber,
            driverName: gate.vehicle.driverName ?? null,
            driverPhoneNumber: gate.vehicle.driverPhoneNumber ?? null,
            placedTruckSize: gate.vehicle.placedTruckSize ?? null,
            placedTruckType: gate.vehicle.placedTruckType ?? null,
            loadType: gate.vehicle.loadType ?? null,
            vehicleAmount: gate.vehicle.vehicleAmount ?? null,
            vehicleExpense: gate.vehicle.vehicleExpense ?? null,
            location: gate.vehicle.location,
            locationReachedAt: gate.vehicle.locationReachedAt?.toISOString() ?? null,
            unloadedAt: gate.vehicle.unloadedAt?.toISOString() ?? null,
            billedOn: gate.vehicle.billedOn?.toISOString() ?? null,
            filledOn: gate.vehicle.filledOn?.toISOString() ?? null,
            dbWaitingTimeHours: gate.vehicle.dbWaitingTimeHours,
            loadingQuantity: gate.vehicle.loadingQuantity ?? null,
            checkInAt: gate.vehicle.checkInAt?.toISOString() ?? null,
            gateInAt: gate.vehicle.gateInAt?.toISOString() ?? null,
            gateOutAt: gate.vehicle.gateOutAt?.toISOString() ?? null,
            loadingStartedAt: gate.vehicle.loadingStartedAt?.toISOString() ?? null,
            loadingCompletedAt: gate.vehicle.loadingCompletedAt?.toISOString() ?? null,
            status: gate.vehicle.status as VehicleStatus,
            invoiceStatus: gate.vehicle.invoiceStatus,
            isPaid: gate.vehicle.isPaid,
            profit: gate.vehicle.profit,
            createdAt: gate.vehicle.createdAt.toISOString(),
            updatedAt: gate.vehicle.updatedAt.toISOString(),
          }
        : null,
      salesOrder: mapGateSalesOrder(gate.salesOrder),
    };
  }
}

@CommandHandler(UpdateGateVehicleCommand)
export class UpdateGateVehicleHandler
  implements ICommandHandler<UpdateGateVehicleCommand, GateDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateGateVehicleCommand): Promise<GateDto> {
    const gate = await (this.prisma as any).gate.findFirst({
      where: { id: command.gateId, tenantId: command.tenantId },
      include: { vehicle: true, salesOrder: true },
    });
    if (!gate) {
      throw new NotFoundException('Gate entry not found');
    }

    const updates: Record<string, any> = {};
    Object.entries(command.payload).forEach(([key, value]) => {
      if (value === undefined) return;
      if (['notes', 'vehicleNumber'].includes(key)) {
        updates[key] = value;
      }
    });

    if (Object.keys(updates).length === 0) {
      return this.mapGate(gate);
    }

    const updated = await (this.prisma as any).gate.update({
      where: { id: gate.id },
      data: updates,
      include: { vehicle: true, salesOrder: true },
    });

    return this.mapGate(updated);
  }

  private mapGate(gate: any): GateDto {
    return {
      id: gate.id,
      tenantId: gate.tenantId,
      vehicleId: gate.vehicleId,
      vehicleNumber: gate.vehicleNumber,
      salesOrderId: gate.salesOrderId,
      soNumber: gate.salesOrder?.soNumber ?? null,
      status: gate.status as GateStatus,
      checkInAt: gate.checkInAt.toISOString(),
      gateInAt: gate.gateInAt?.toISOString() ?? null,
      gateOutAt: gate.gateOutAt?.toISOString() ?? null,
      notes: gate.notes ?? null,
      createdAt: gate.createdAt.toISOString(),
      updatedAt: gate.updatedAt.toISOString(),
      vehicle: gate.vehicle
        ? {
            id: gate.vehicle.id,
            tenantId: gate.vehicle.tenantId,
            vehicleNumber: gate.vehicle.vehicleNumber,
            driverName: gate.vehicle.driverName ?? null,
            driverPhoneNumber: gate.vehicle.driverPhoneNumber ?? null,
            placedTruckSize: gate.vehicle.placedTruckSize ?? null,
            placedTruckType: gate.vehicle.placedTruckType ?? null,
            loadType: gate.vehicle.loadType ?? null,
            vehicleAmount: gate.vehicle.vehicleAmount ?? null,
            vehicleExpense: gate.vehicle.vehicleExpense ?? null,
            location: gate.vehicle.location,
            locationReachedAt: gate.vehicle.locationReachedAt?.toISOString() ?? null,
            unloadedAt: gate.vehicle.unloadedAt?.toISOString() ?? null,
            billedOn: gate.vehicle.billedOn?.toISOString() ?? null,
            filledOn: gate.vehicle.filledOn?.toISOString() ?? null,
            dbWaitingTimeHours: gate.vehicle.dbWaitingTimeHours,
            loadingQuantity: gate.vehicle.loadingQuantity ?? null,
            checkInAt: gate.vehicle.checkInAt?.toISOString() ?? null,
            gateInAt: gate.vehicle.gateInAt?.toISOString() ?? null,
            gateOutAt: gate.vehicle.gateOutAt?.toISOString() ?? null,
            loadingStartedAt: gate.vehicle.loadingStartedAt?.toISOString() ?? null,
            loadingCompletedAt: gate.vehicle.loadingCompletedAt?.toISOString() ?? null,
            status: gate.vehicle.status as VehicleStatus,
            invoiceStatus: gate.vehicle.invoiceStatus,
            isPaid: gate.vehicle.isPaid,
            profit: gate.vehicle.profit,
            createdAt: gate.vehicle.createdAt.toISOString(),
            updatedAt: gate.vehicle.updatedAt.toISOString(),
          }
        : null,
      salesOrder: mapGateSalesOrder(gate.salesOrder),
    };
  }
}

@CommandHandler(DeleteGateVehicleCommand)
export class DeleteGateVehicleHandler
  implements ICommandHandler<DeleteGateVehicleCommand, void>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: DeleteGateVehicleCommand): Promise<void> {
    const gate = await (this.prisma as any).gate.findFirst({
      where: { id: command.gateId, tenantId: command.tenantId },
      include: { vehicle: true },
    });
    if (!gate) {
      throw new NotFoundException('Gate entry not found');
    }

    // Security can only delete gate entries before loading starts
    if (gate.vehicle) {
      const vehicleStatus = gate.vehicle.status as VehicleStatus;
      if (
        vehicleStatus === VehicleStatus.LOADING_START ||
        vehicleStatus === VehicleStatus.LOADING_COMPLETE ||
        vehicleStatus === VehicleStatus.GATE_OUT ||
        vehicleStatus === VehicleStatus.IN_JOURNEY ||
        vehicleStatus === VehicleStatus.COMPLETED
      ) {
        throw new ForbiddenException(
          'Cannot delete gate entry once loading has started or vehicle has progressed further',
        );
      }
    }

    // Only allow deletion if status is CHECK_IN
    if (gate.status !== GateStatus.CHECK_IN) {
      throw new ForbiddenException('Can only delete gate entries in CHECK_IN status');
    }

    await (this.prisma as any).gate.delete({
      where: { id: gate.id },
    });
  }
}

@CommandHandler(CheckInVehicleCommand)
export class CheckInVehicleHandler
  implements ICommandHandler<CheckInVehicleCommand, GateDto>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CheckInVehicleCommand): Promise<GateDto> {
    const { tenantId, vehicleNumber } = command;
    if (!vehicleNumber || !vehicleNumber.trim()) {
      throw new BadRequestException('Vehicle number is required');
    }

    const trimmedVehicleNumber = vehicleNumber.trim();

    // Find vehicle by vehicle number
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        tenantId,
        vehicleNumber: {
          equals: trimmedVehicleNumber,
          mode: 'insensitive',
        },
      },
      include: {
        salesOrders: {
          include: {
            salesOrder: true,
          },
        },
      },
    });

    let salesOrderId: string | null = null;
    if (vehicle && vehicle.salesOrders.length > 0) {
      // Link to first sales order if vehicle is assigned
      salesOrderId = vehicle.salesOrders[0].salesOrderId;
    }

    // Create gate entry
    const gate = await this.prisma.$transaction(async (tx) => {
      const gateEntry = await (tx as any).gate.create({
        data: {
          tenantId,
          vehicleId: vehicle?.id ?? null,
          vehicleNumber: trimmedVehicleNumber,
          salesOrderId,
          status: GateStatus.CHECK_IN,
          checkInAt: new Date(),
        },
        include: {
          vehicle: true,
          salesOrder: true,
        },
      });

      // If vehicle is linked, update vehicle status to ARRIVED
      if (vehicle) {
        const currentStatus = vehicle.status as VehicleStatus;
        if (currentStatus !== VehicleStatus.ARRIVED) {
          try {
            assertForwardVehicleStatus(currentStatus, VehicleStatus.ARRIVED);
            await tx.vehicle.update({
              where: { id: vehicle.id },
              data: {
                status: VehicleStatus.ARRIVED,
                checkInAt: vehicle.checkInAt ?? new Date(),
              },
            });
            // Sync linked SO statuses to Arrived
            await syncSalesOrderStatusFromVehicle(
              tx,
              tenantId,
              vehicle.id,
              VehicleStatus.ARRIVED,
            );
          } catch (error) {
            // Status transition invalid, skip vehicle update
          }
        }
      }

      return gateEntry;
    });

    return this.mapGate(gate);
  }

  private mapGate(gate: any): GateDto {
    return {
      id: gate.id,
      tenantId: gate.tenantId,
      vehicleId: gate.vehicleId,
      vehicleNumber: gate.vehicleNumber,
      salesOrderId: gate.salesOrderId,
      soNumber: gate.salesOrder?.soNumber ?? null,
      status: gate.status as GateStatus,
      checkInAt: gate.checkInAt.toISOString(),
      gateInAt: gate.gateInAt?.toISOString() ?? null,
      gateOutAt: gate.gateOutAt?.toISOString() ?? null,
      notes: gate.notes ?? null,
      createdAt: gate.createdAt.toISOString(),
      updatedAt: gate.updatedAt.toISOString(),
      vehicle: gate.vehicle
        ? {
            id: gate.vehicle.id,
            tenantId: gate.vehicle.tenantId,
            vehicleNumber: gate.vehicle.vehicleNumber,
            driverName: gate.vehicle.driverName ?? null,
            driverPhoneNumber: gate.vehicle.driverPhoneNumber ?? null,
            placedTruckSize: gate.vehicle.placedTruckSize ?? null,
            placedTruckType: gate.vehicle.placedTruckType ?? null,
            loadType: gate.vehicle.loadType ?? null,
            vehicleAmount: gate.vehicle.vehicleAmount ?? null,
            vehicleExpense: gate.vehicle.vehicleExpense ?? null,
            location: gate.vehicle.location,
            locationReachedAt: gate.vehicle.locationReachedAt?.toISOString() ?? null,
            unloadedAt: gate.vehicle.unloadedAt?.toISOString() ?? null,
            billedOn: gate.vehicle.billedOn?.toISOString() ?? null,
            filledOn: gate.vehicle.filledOn?.toISOString() ?? null,
            dbWaitingTimeHours: gate.vehicle.dbWaitingTimeHours,
            loadingQuantity: gate.vehicle.loadingQuantity ?? null,
            checkInAt: gate.vehicle.checkInAt?.toISOString() ?? null,
            gateInAt: gate.vehicle.gateInAt?.toISOString() ?? null,
            gateOutAt: gate.vehicle.gateOutAt?.toISOString() ?? null,
            loadingStartedAt: gate.vehicle.loadingStartedAt?.toISOString() ?? null,
            loadingCompletedAt: gate.vehicle.loadingCompletedAt?.toISOString() ?? null,
            status: gate.vehicle.status as VehicleStatus,
            invoiceStatus: gate.vehicle.invoiceStatus,
            isPaid: gate.vehicle.isPaid,
            profit: gate.vehicle.profit,
            createdAt: gate.vehicle.createdAt.toISOString(),
            updatedAt: gate.vehicle.updatedAt.toISOString(),
          }
        : null,
      salesOrder: mapGateSalesOrder(gate.salesOrder),
    };
  }
}

export const GateHandlers = [
  ListGateVehiclesHandler,
  GateInVehicleHandler,
  GateOutVehicleHandler,
  UpdateGateVehicleHandler,
  DeleteGateVehicleHandler,
  CheckInVehicleHandler,
];
