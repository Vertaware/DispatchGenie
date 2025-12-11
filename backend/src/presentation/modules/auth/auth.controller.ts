import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  GetMeQuery,
  RequestOtpCommand,
  VerifyOtpCommand,
} from '../../../application/auth/auth.handlers';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/enums/index';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post('request-otp')
  @ApiOperation({ summary: 'Request a one-time password for login' })
  async requestOtp(@Body() dto: RequestOtpDto): Promise<void> {
    await this.commandBus.execute(new RequestOtpCommand(dto.tenantSlug, dto.email));
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify the provided OTP and receive JWT tokens' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.commandBus.execute(
      new VerifyOtpCommand(dto.tenantSlug, dto.email, dto.code),
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retrieve the authenticated user profile' })
  async me(@CurrentUser() user: AuthenticatedUser | null) {
    return this.queryBus.execute(new GetMeQuery(user as AuthenticatedUser));
  }
}
