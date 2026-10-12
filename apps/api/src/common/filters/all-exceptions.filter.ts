import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toErrorBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        error: STATUS_CODES[statusCode] ?? 'Error',
        message: this.httpMessage(exception.getResponse(), statusCode),
      };
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: STATUS_CODES[HttpStatus.INTERNAL_SERVER_ERROR] ?? 'Error',
      message: 'Internal server error',
    };
  }

  private httpMessage(
    payload: string | object,
    statusCode: number,
  ): string | string[] {
    if (typeof payload === 'string') {
      return payload;
    }
    if ('message' in payload) {
      const { message } = payload;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.map(String);
      }
    }
    return STATUS_CODES[statusCode] ?? 'Error';
  }
}
