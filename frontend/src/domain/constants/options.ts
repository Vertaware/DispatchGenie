import type { PaymentRequestType } from "../entities/payment";

const TRUCK_TYPE_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "CLOSED_OPEN", label: "Closed/Open" },
];

const TRUCK_SIZES_OPTIONS = [
  { value: "NINE_MT", label: "9MT" },
  { value: "TWELVE_MT", label: "12MT" },
  { value: "SIXTEEN_MT", label: "16MT" },
  { value: "EIGHTEEN_MT", label: "18MT" },
];

const TRANSACTION_TYPES_OPTIONS: { value: PaymentRequestType; label: string }[] = [
  { value: "ADVANCE_SHIPPING", label: "Advance Shipping" },
  { value: "BALANCE_SHIPPING", label: "Balance Shipping" },
  { value: "FULL_SHIPPING_CHARGES", label: "Full Shipping Charges" },
  {
    value: "POINT_1_TO_POINT_2_TRANSFER",
    label: "Point 1 to Point 2 Transfer",
  },
  { value: "UNLOADING_CHARGE", label: "Unloading Charge" },
  { value: "UNLOADING_DETENTION", label: "Unloading Detention" },
  { value: "MISCELLANEOUS_CHARGES", label: "Miscellaneous Charges" },
];

const TRUCK_SIZES_MAPPER: any = {
  NINE_MT: "9MT",
  TWELVE_MT: "12MT",
  SIXTEEN_MT: "16MT",
  EIGHTEEN_MT: "18MT",
};

export { TRANSACTION_TYPES_OPTIONS, TRUCK_SIZES_MAPPER, TRUCK_SIZES_OPTIONS, TRUCK_TYPE_OPTIONS };
