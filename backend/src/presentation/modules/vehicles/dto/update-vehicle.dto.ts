import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateVehicleDto {
  // Legacy field names (for backward compatibility)
  @IsOptional()
  @IsString()
  vehicleName?: string;

  @IsOptional()
  @IsString()
  driverPhone?: string;

  @IsOptional()
  @IsString()
  truckSize?: string;

  @IsOptional()
  @IsString()
  truckType?: string;

  @IsOptional()
  @IsNumber()
  shippingAmount?: number;

  @IsOptional()
  @IsNumber()
  shippingExpense?: number;

  // New field names
  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  driverPhoneNumber?: string;

  @IsOptional()
  @IsString()
  asmPhoneNumber?: string;

  @IsOptional()
  @IsString()
  placedTruckSize?: string;

  @IsOptional()
  @IsString()
  placedTruckType?: string;

  @IsOptional()
  @IsNumber()
  vehicleAmount?: number;

  @IsOptional()
  @IsNumber()
  vehicleExpense?: number;

  // Common fields
  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  loadType?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  locationReachedAt?: string;

  @IsOptional()
  @IsDateString()
  unloadedAt?: string;

  @IsOptional()
  @IsDateString()
  billedOn?: string;

  @IsOptional()
  @IsDateString()
  filledOn?: string;

  @IsOptional()
  @IsNumber()
  dbWaitingTimeHours?: number;

  @IsOptional()
  @IsNumber()
  loadingQuantity?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  invoiceStatus?: string;

  @IsOptional()
  isPaid?: boolean;
}
