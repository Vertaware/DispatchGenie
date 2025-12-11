import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

export interface SendOtpPayload {
  to: string;
  code: string;
  tenantName: string;
}

@Injectable()
export class SendGridEmailService {
  private readonly logger = new Logger(SendGridEmailService.name);
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
    } else {
      this.logger.warn('SENDGRID_API_KEY not configured. Emails will be logged.');
      this.isConfigured = false;
    }
  }

  async sendOtpEmail(payload: SendOtpPayload): Promise<void> {
    const fromEmail = this.configService.get<string>('sendgrid.fromEmail') ?? 'noreply@example.com';
    if (!this.isConfigured) {
      this.logger.log(`OTP for tenant ${payload.tenantName} to ${payload.to}: ${payload.code}`);
      return;
    }
    await sgMail.send({
      to: payload.to,
      from: fromEmail,
      subject: `${payload.tenantName} Login Code`,
      text: `Your LogisticsPro login code is ${payload.code}`,
    });
  }
}
