import {
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateIf,
  IsDateString,
} from 'class-validator';
import { PaymentRequestType } from '~/enums/index';

export class CreatePaymentRequestDto {
  @IsString()
  salesOrderId!: string;

  @IsString()
  vehicleId!: string;

  @IsEnum(PaymentRequestType)
  transactionType!: PaymentRequestType;

  @IsNumber()
  requestedAmount!: number;

  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  // Optional flags allowed to pass through validation; actual values are derived server-side
  @IsOptional()
  @IsBoolean()
  hasUnloadingCharge?: boolean;

  // Conditional fields for UNLOADING_DETENTION
  @ValidateIf(
    (dto: CreatePaymentRequestDto) =>
      dto.transactionType === PaymentRequestType.UNLOADING_DETENTION,
  )
  @IsNotEmpty({
    message: 'locationReachedAt is required for UNLOADING_DETENTION payment requests',
  })
  @IsDateString(
    {},
    {
      message: 'locationReachedAt must be a valid ISO 8601 date string',
    }
  )
  locationReachedAt?: string;

  @ValidateIf(
    (dto: CreatePaymentRequestDto) =>
      dto.transactionType === PaymentRequestType.UNLOADING_DETENTION,
  )
  @IsNotEmpty({
    message: 'unloadedTime is required for UNLOADING_DETENTION payment requests',
  })
  @IsDateString(
    {},
    {
      message: 'unloadedTime must be a valid ISO 8601 date string',
    }
  )
  unloadedTime?: string;

  @IsOptional()
  @IsString()
  @ValidateIf(
    (dto: CreatePaymentRequestDto) =>
      dto.transactionType === PaymentRequestType.MISCELLANEOUS_CHARGES,
  )
  @IsNotEmpty({
    message: 'Notes are required for MISCELLANEOUS_CHARGES payments',
  })
  notes?: string;
}
