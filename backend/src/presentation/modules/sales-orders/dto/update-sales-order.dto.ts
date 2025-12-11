import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  LoadType,
  SalesOrderStatus,
  TruckSize,
  TruckType,
} from "../../../../shared/enums/index";
import { SalesOrderArticleDto } from "./create-sales-order.dto";

export class UpdateSalesOrderDto {
  @IsOptional()
  @IsDateString()
  soDate?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  partyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  townName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pinCode?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsNumber()
  soCases?: number;

  @IsOptional()
  @IsString()
  articleDescription?: string;

  @IsOptional()
  @IsString()
  caseLot?: string;

  @IsOptional()
  @IsNumber()
  requestedOrderQuantity?: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsString()
  plant?: string;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsEnum(TruckSize)
  requestedTruckSize?: TruckSize | null;

  @IsOptional()
  @IsEnum(TruckType)
  requestedTruckType?: TruckType;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsEnum(TruckSize)
  placedTruckSize?: TruckSize | null;

  @IsOptional()
  @IsEnum(TruckType)
  placedTruckType?: TruckType;

  @IsOptional()
  @IsEnum(LoadType)
  loadType?: LoadType;

  @IsOptional()
  @IsString()
  partyAddress?: string;

  @IsOptional()
  finalAmount?: number;

  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

  @IsOptional()
  @IsNumber()
  loadingQuantity?: number;

  @IsOptional()
  @IsNumber()
  actualUnloadingCharges?: number;

  @IsOptional()
  @IsNumber()
  otherExpenses?: number;

  @IsOptional()
  @IsNumber()
  advancePayment?: number;

  @IsOptional()
  @IsNumber()
  finalPayment?: number;

  @IsOptional()
  @IsNumber()
  frightCost?: number;

  @IsOptional()
  @IsNumber()
  profit?: number;

  @IsOptional()
  @IsString()
  invoiceEwayBill?: string;

  @IsOptional()
  @IsString()
  lrNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  tripReferenceNo?: number;

  @IsOptional()
  @IsString()
  lrCopyDocumentId?: string;

  @IsOptional()
  @IsString()
  podCopyDocumentId?: string;

  @IsOptional()
  @IsArray()
  loadingPhotosDocumentIds?: string[];

  @IsOptional()
  @IsString()
  advancePaymentScreenshotDocumentId?: string;

  @IsOptional()
  @IsString()
  finalPaymentScreenshotDocumentId?: string;

  @IsOptional()
  @IsString()
  unloadingExpensesScreenshotDocumentId?: string;

  @IsOptional()
  @IsString()
  uid?: string;

  @IsOptional()
  @IsNumber()
  duplicates?: number;

  @IsOptional()
  @IsString()
  flag?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderArticleDto)
  articles?: SalesOrderArticleDto[];
}
