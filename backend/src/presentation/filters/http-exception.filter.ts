import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: unknown;
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res) {
        const body = res as Record<string, unknown>;
        message = (body.message as string) ?? message;
        details = body.details ?? details;
        code = (body.code as string) ?? code;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      details = exception.stack;
    }

    this.logger.error(
      `${request.method} ${request.url} -> ${status} ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
