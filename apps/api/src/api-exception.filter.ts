import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : undefined;

    // Erros não-HTTP não têm mensagem pública; sem este log o 500 fica sem
    // causa registrada e impossível de diagnosticar em execução.
    if (!isHttp || statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

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
