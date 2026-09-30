import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : undefined;
    const source =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const message =
      source.message ??
      (isHttp ? exception.message : "Erro interno inesperado.");

    response.status(statusCode).json({
      statusCode,
      code:
        source.error ??
        (statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
