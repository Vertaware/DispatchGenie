import { SalesOrderStatus, VehicleStatus } from "../../shared/enums/enums";

export const SALES_ORDER_STATUS_SEQUENCE: SalesOrderStatus[] = [
  SalesOrderStatus.INFORMATION_NEEDED,
  SalesOrderStatus.ASSIGN_VEHICLE,
  SalesOrderStatus.VEHICLE_ASSIGNED,
  SalesOrderStatus.ARRIVED,
  SalesOrderStatus.GATE_IN,
  SalesOrderStatus.LOADING_START,
  SalesOrderStatus.LOADING_COMPLETE,
  SalesOrderStatus.GATE_OUT,
  SalesOrderStatus.IN_JOURNEY,
  SalesOrderStatus.COMPLETED,
  SalesOrderStatus.TRIP_INVOICED,
  SalesOrderStatus.INVOICED,
  SalesOrderStatus.CANCELLED,
];

const FROZEN_SALES_ORDER_STATUSES = new Set<SalesOrderStatus>([
  SalesOrderStatus.HOLD,
  SalesOrderStatus.DELETED,
]);

const LOADING_COMPLETE_INDEX = SALES_ORDER_STATUS_SEQUENCE.indexOf(
  SalesOrderStatus.LOADING_COMPLETE
);

export const isSalesOrderFrozen = (status: SalesOrderStatus): boolean =>
  FROZEN_SALES_ORDER_STATUSES.has(status);

export const isAfterLoadingComplete = (status: SalesOrderStatus): boolean => {
  const index = SALES_ORDER_STATUS_SEQUENCE.indexOf(status);
  return index !== -1 && index > LOADING_COMPLETE_INDEX;
};

export const isHoldOrDeleteEligible = (status: SalesOrderStatus): boolean => {
  if (isSalesOrderFrozen(status)) {
    return false;
  }
  const index = SALES_ORDER_STATUS_SEQUENCE.indexOf(status);
  return index !== -1 && index <= LOADING_COMPLETE_INDEX;
};

export const VEHICLE_STATUS_SEQUENCE: VehicleStatus[] = [
  VehicleStatus.ASSIGNED,
  VehicleStatus.ARRIVED,
  VehicleStatus.GATE_IN,
  VehicleStatus.LOADING_START,
  VehicleStatus.LOADING_COMPLETE,
  VehicleStatus.TRIP_INVOICED,
  VehicleStatus.GATE_OUT,
  VehicleStatus.IN_JOURNEY,
  VehicleStatus.COMPLETED,
  VehicleStatus.INVOICED,
  VehicleStatus.CANCELLED,
];

interface SalesOrderAssignmentFieldGroup {
  label: keyof SalesOrderEligibilityCandidate;
  keys: Array<keyof SalesOrderEligibilityCandidate>;
}

export const VEHICLE_ASSIGNMENT_FIELDS: SalesOrderAssignmentFieldGroup[] = [
  { label: "soNumber", keys: ["soNumber"] },
  /*  { label: "articleDescription", keys: ["articleDescription"] }, */
  { label: "soCases", keys: ["soCases"] },
  { label: "caseLot", keys: ["caseLot"] },
  { label: "townName", keys: ["townName"] },
  { label: "pinCode", keys: ["pinCode"] },
  { label: "requestedTruckSize", keys: ["requestedTruckSize"] },
  { label: "requestedTruckType", keys: ["requestedTruckType"] },
];

export interface SalesOrderEligibilityCandidate {
  soNumber?: string | null;
  /* articleDescription?: string | null; */
  articles?: string | any[] | null; // Can be JSON string or parsed array
  soCases?: number | null;
  caseLot?: string | null;
  townName?: string | null;
  pinCode?: string | null;
  requestedTruckSize?: string | null;
  requestedTruckType?: string | null;
}

export const isSalesOrderVehicleEligible = (
  candidate: SalesOrderEligibilityCandidate
): boolean =>
  VEHICLE_ASSIGNMENT_FIELDS.every((group) =>
    hasAnyValue(candidate, group.keys)
  );

export const getMissingSalesOrderEligibilityFields = (
  candidate: SalesOrderEligibilityCandidate
): Array<keyof SalesOrderEligibilityCandidate> =>
  VEHICLE_ASSIGNMENT_FIELDS.filter(
    (group) => !hasAnyValue(candidate, group.keys)
  ).map((group) => group.label);

const hasAnyValue = (
  candidate: SalesOrderEligibilityCandidate,
  fields: Array<keyof SalesOrderEligibilityCandidate>
): boolean =>
  fields.some((field) => {
    // Special handling for articleDescription - check articles array if articleDescription is missing
    /*  if (field === "articleDescription") {
      // First check if articleDescription exists directly
      const articleDescription = candidate.articleDescription;
      if (
        articleDescription &&
        typeof articleDescription === "string" &&
        articleDescription.trim().length > 0
      ) {
        return true;
      }

      // If not, check articles array
      const articles = candidate.articles;
      if (articles) {
        try {
          // Parse articles if it's a JSON string
          const parsedArticles =
            typeof articles === "string" ? JSON.parse(articles) : articles;
          if (Array.isArray(parsedArticles) && parsedArticles.length > 0) {
            // Check if any article has a description
            return parsedArticles.some((article: any) => {
              const desc = article?.articleDescription;
              return desc && typeof desc === "string" && desc.trim().length > 0;
            });
          }
        } catch {
          // If parsing fails, ignore
        }
      }
      return false;
    } */

    const value = candidate[field];
    if (typeof value === "number") {
      return Number.isFinite(value) && value > 0;
    }
    return typeof value === "string" && value.trim().length > 0;
  });

export const deriveSalesOrderStatus = (
  candidate: SalesOrderEligibilityCandidate
): SalesOrderStatus =>
  isSalesOrderVehicleEligible(candidate)
    ? SalesOrderStatus.ASSIGN_VEHICLE
    : SalesOrderStatus.INFORMATION_NEEDED;

export const assertForwardSalesOrderStatus = (
  current: SalesOrderStatus,
  next: SalesOrderStatus
) => {
  if (isSalesOrderFrozen(current) || isSalesOrderFrozen(next)) {
    throw new Error(
      `Cannot move frozen sales order status (${current} -> ${next})`
    );
  }
  if (current === next) {
    return;
  }
  const currentIndex = SALES_ORDER_STATUS_SEQUENCE.indexOf(current);
  const nextIndex = SALES_ORDER_STATUS_SEQUENCE.indexOf(next);
  if (nextIndex === -1) {
    throw new Error(
      `Unsupported sales order status transition target: ${next}`
    );
  }
  if (currentIndex === -1) {
    throw new Error(`Unsupported sales order status source: ${current}`);
  }
  if (nextIndex < currentIndex) {
    throw new Error(
      `Cannot move sales order status backwards (${current} -> ${next})`
    );
  }
};

export const assertForwardVehicleStatus = (
  current: VehicleStatus,
  next: VehicleStatus
) => {
  if (current === next) {
    return;
  }
  const currentIndex = VEHICLE_STATUS_SEQUENCE.indexOf(current);
  const nextIndex = VEHICLE_STATUS_SEQUENCE.indexOf(next);
  if (nextIndex === -1) {
    throw new Error(`Unsupported vehicle status transition target: ${next}`);
  }
  if (currentIndex === -1) {
    throw new Error(`Unsupported vehicle status source: ${current}`);
  }
  if (nextIndex < currentIndex) {
    throw new Error(
      `Cannot move vehicle status backwards (${current} -> ${next})`
    );
  }
};

/**
 * Maps Vehicle status to corresponding SalesOrder status
 */
export const mapVehicleStatusToSalesOrderStatus = (
  vehicleStatus: VehicleStatus
): SalesOrderStatus => {
  const mapping: Record<VehicleStatus, SalesOrderStatus> = {
    [VehicleStatus.ASSIGNED]: SalesOrderStatus.VEHICLE_ASSIGNED,
    [VehicleStatus.ARRIVED]: SalesOrderStatus.ARRIVED,
    [VehicleStatus.GATE_IN]: SalesOrderStatus.GATE_IN,
    [VehicleStatus.LOADING_START]: SalesOrderStatus.LOADING_START,
    [VehicleStatus.LOADING_COMPLETE]: SalesOrderStatus.LOADING_COMPLETE,
    [VehicleStatus.TRIP_INVOICED]: SalesOrderStatus.TRIP_INVOICED,
    [VehicleStatus.GATE_OUT]: SalesOrderStatus.GATE_OUT,
    [VehicleStatus.IN_JOURNEY]: SalesOrderStatus.IN_JOURNEY,
    [VehicleStatus.COMPLETED]: SalesOrderStatus.COMPLETED,
    [VehicleStatus.INVOICED]: SalesOrderStatus.INVOICED,
    [VehicleStatus.CANCELLED]: SalesOrderStatus.CANCELLED,
  };
  return mapping[vehicleStatus] ?? SalesOrderStatus.VEHICLE_ASSIGNED;
};

/**
 * Syncs linked SalesOrder statuses when Vehicle status changes
 */
export async function syncSalesOrderStatusFromVehicle(
  tx: any,
  tenantId: string,
  vehicleId: string,
  vehicleStatus: VehicleStatus
): Promise<void> {
  const targetSoStatus = mapVehicleStatusToSalesOrderStatus(vehicleStatus);
  const links = await tx.vehicleSalesOrder.findMany({
    where: { tenantId, vehicleId },
    include: { salesOrder: true },
  });

  for (const link of links) {
    const currentSoStatus = link.salesOrder.status as SalesOrderStatus;
    if (isSalesOrderFrozen(currentSoStatus)) {
      continue;
    }
    try {
      assertForwardSalesOrderStatus(currentSoStatus, targetSoStatus);
      await tx.salesOrder.update({
        where: { id: link.salesOrderId },
        data: { status: targetSoStatus },
      });
    } catch (error) {
      // Skip if status transition is invalid (e.g., SO already ahead)
      // This can happen if SO was updated independently
    }
  }
}
