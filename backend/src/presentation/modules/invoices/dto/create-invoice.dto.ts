import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateInvoiceDto {
  @IsString()
  invoiceNumber!: string;

  @IsDateString()
  date!: string;

  @IsArray()
  @ArrayNotEmpty()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return [value.trim()];
    }
    return [];
  })
  @IsString({ each: true })
  vehicleIds!: string[];

  @IsOptional()
  @IsNumber()
  overrideInvoiceAmount?: number;
}
