import { IsDateString, IsNumber, IsString } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  transactionCode!: string;

  @IsString()
  beneficiaryId!: string;

  @IsNumber()
  totalPaidAmount!: number;

  @IsDateString()
  transactionDate!: string;
}
