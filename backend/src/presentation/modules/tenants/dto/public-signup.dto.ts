import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class PublicTenantSignupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  slug!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  adminName!: string;
}
