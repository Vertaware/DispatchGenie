import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LoadType, SalesOrderDto, TruckType, VehicleStatus } from '~/enums/index';

export class SearchBySoNumberQuery {
  constructor(
    public readonly tenantId: string,
    public readonly soNumber: string,
  ) {}
}

export class SearchByVehicleNumberQuery {
  constructor(
    public readonly tenantId: string,
    public readonly vehicleNumber: string,
  ) {}
}

interface AccountingSearchResult {
  salesOrder: SalesOrderDto;
  vehicle: any;
}

const toSalesOrderDto = (order: any): SalesOrderDto => {
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
    requestedTruckType:
      (order.requestedTruckType as TruckType | null) ??
      (legacyOrder.requestedTruckType as TruckType | null) ??
      null,
    partyAddress,
    status: order.status,
    finalAmount: order.finalAmount,
    loadingQuantity: order.loadingQuantity,
    createdFromImport: order.createdFromImport,
    fieldSource: order.fieldSource,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    placedTruckSize: order.placedTruckSize ?? null,
    placedTruckType: (order.placedTruckType as TruckType | null) ?? null,
    loadType: (order.loadType as LoadType | null) ?? null,
  };
};

const toVehicleDto = (vehicle: any) => {
  const legacyVehicle = vehicle as any;
  return {
    id: vehicle.id,
    tenantId: vehicle.tenantId,
    vehicleNumber: vehicle.vehicleNumber,
    driverName: vehicle.driverName ?? legacyVehicle.vehicleName ?? null,
    driverPhoneNumber: vehicle.driverPhoneNumber ?? legacyVehicle.driverPhone ?? null,
    placedTruckSize: vehicle.placedTruckSize ?? legacyVehicle.truckSize ?? null,
    placedTruckType: vehicle.placedTruckType ?? legacyVehicle.truckType ?? null,
    loadType: vehicle.loadType,
    vehicleAmount: vehicle.vehicleAmount ?? legacyVehicle.shippingAmount ?? null,
    vehicleExpense: vehicle.vehicleExpense ?? legacyVehicle.shippingExpense ?? null,
    location: vehicle.location,
    status: vehicle.status,
    invoiceStatus: vehicle.invoiceStatus,
    isPaid: vehicle.isPaid,
    profit: vehicle.profit,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
};

@QueryHandler(SearchBySoNumberQuery)
export class SearchBySoNumberHandler
  implements IQueryHandler<SearchBySoNumberQuery, AccountingSearchResult[]>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: SearchBySoNumberQuery): Promise<AccountingSearchResult[]> {
    if (!query.soNumber || query.soNumber.trim().length < 2) {
      return [];
    }

    const orders = await this.prisma.salesOrder.findMany({
      where: {
        tenantId: query.tenantId,
        soNumber: {
          contains: query.soNumber.trim(),
          mode: 'insensitive',
        },
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
      take: 20,
    });

    return orders.map((order) => {
      const vehicleLink = order.vehicleLinks[0];
      return {
        salesOrder: toSalesOrderDto(order),
        vehicle: vehicleLink ? toVehicleDto(vehicleLink.vehicle) : null,
      };
    });
  }
}

@QueryHandler(SearchByVehicleNumberQuery)
export class SearchByVehicleNumberHandler
  implements IQueryHandler<SearchByVehicleNumberQuery, AccountingSearchResult[]>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: SearchByVehicleNumberQuery): Promise<AccountingSearchResult[]> {
    if (!query.vehicleNumber || query.vehicleNumber.trim().length < 2) {
      return [];
    }

    // Find vehicles with matching number and status not Complete
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        tenantId: query.tenantId,
        vehicleNumber: {
          contains: query.vehicleNumber.trim(),
          mode: 'insensitive',
        },
        status: {
          not: VehicleStatus.COMPLETED,
        },
      },
      include: {
        salesOrders: {
          include: {
            salesOrder: true,
          },
        },
      },
      take: 20,
    });

    const results: AccountingSearchResult[] = [];
    for (const vehicle of vehicles) {
      for (const link of vehicle.salesOrders) {
        results.push({
          salesOrder: toSalesOrderDto(link.salesOrder),
          vehicle: toVehicleDto(vehicle),
        });
      }
    }

    return results;
  }
}

export const AccountingHandlers = [SearchBySoNumberHandler, SearchByVehicleNumberHandler];

