import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class AssignVehicleDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  salesOrderIds!: string[];

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ValidateIf((o) => !o.vehicleId)
  @IsString()
  @MaxLength(20)
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  vehicleName?: string;

  @IsOptional()
  @IsString()
  driverPhoneNumber?: string;

  @IsOptional()
  @IsString()
  driverPhone?: string;

  @IsOptional()
  @IsString()
  asmPhoneNumber?: string;

  @IsOptional()
  @IsString()
  placedTruckSize?: string;

  @IsOptional()
  @IsString()
  truckSize?: string;

  @IsOptional()
  @IsString()
  placedTruckType?: string;

  @IsOptional()
  @IsString()
  truckType?: string;

  @IsOptional()
  @IsString()
  loadType?: string;

  @IsOptional()
  @IsNumber()
  vehicleAmount?: number;

  @IsOptional()
  @IsNumber()
  shippingAmount?: number;

  @IsOptional()
  @IsNumber()
  vehicleExpense?: number;

  @IsOptional()
  @IsNumber()
  shippingExpense?: number;

  @IsOptional()
  @IsString()
  location?: string;
}
