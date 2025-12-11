import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class IngestSalesOrderImageDto {
  @IsString()
  @IsNotEmpty()
  soNumber!: string;

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
  @MaxLength(200)
  articleDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  requestedTruckSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  caseLot?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  orderCases?: number;
}

