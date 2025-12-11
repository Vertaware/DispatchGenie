import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBeneficiaryDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(50)
  accountNumber!: string;

  @IsString()
  @MaxLength(200)
  bankNameAndBranch!: string;

  @IsString()
  @MaxLength(20)
  ifscCode!: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;

  @IsOptional()
  @IsString()
  documentId?: string;
}
