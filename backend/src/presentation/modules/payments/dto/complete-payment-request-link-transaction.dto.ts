import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class CompletePaymentRequestLinkTransactionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  transactionIds!: string[];
}

