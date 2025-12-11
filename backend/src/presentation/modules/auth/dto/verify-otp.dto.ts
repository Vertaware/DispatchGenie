import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
