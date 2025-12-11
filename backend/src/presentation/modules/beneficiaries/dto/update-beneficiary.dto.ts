import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBeneficiaryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankNameAndBranch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ifscCode?: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;

  @IsOptional()
  @IsString()
  documentId?: string;
}
