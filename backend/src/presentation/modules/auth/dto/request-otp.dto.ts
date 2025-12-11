import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tenantSlug!: string;

  @IsEmail()
  email!: string;
}
