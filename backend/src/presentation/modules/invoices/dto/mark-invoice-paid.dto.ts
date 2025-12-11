import { IsDateString, IsNumber } from 'class-validator';

export class MarkInvoicePaidDto {
  @IsNumber()
  paidAmount!: number;

  @IsDateString()
  paidDate!: string;
}
