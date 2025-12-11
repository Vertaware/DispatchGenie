import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TenantSubscriptionStatus } from '../../../../shared/enums/index';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  slug!: string;

  @IsOptional()
  @IsEnum(TenantSubscriptionStatus)
  subscriptionStatus?: TenantSubscriptionStatus;
}
