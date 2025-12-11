import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthHandlers } from '../../../application/auth/auth.handlers';
import { SendGridEmailService } from '../../../infrastructure/adapters/sendgrid.adapter';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') ?? 'dev-secret',
        signOptions: { expiresIn: configService.get<string>('jwt.expiresIn') ?? '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [...AuthHandlers, SendGridEmailService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
