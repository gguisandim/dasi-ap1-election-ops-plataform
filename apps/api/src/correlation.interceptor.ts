import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Observable } from "rxjs";
import {
  CORRELATION_ID_HEADER,
  normalizeCorrelationId,
  runWithCorrelationId,
} from "@eops/shared/correlation";

interface CorrelationCarrier {
  headers?: Record<string, string | string[] | undefined>;
  setHeader?: (name: string, value: string) => void;
}

/**
 * Estabelece o correlation ID da cadeia operacional.
 *
 * O valor vem do header `x-correlation-id` quando presente e válido; caso
 * contrário é gerado. Ele é devolvido na resposta e fica ativo durante todo o
 * processamento, de modo que serviços, Event Bus e auditoria o enxerguem sem
 * receber parâmetro adicional.
 *
 * Um header inválido nunca causa erro: apenas é ignorado em favor de um valor
 * gerado.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<CorrelationCarrier & { headers?: Record<string, unknown> }>();
    const response = http.getResponse<CorrelationCarrier>();

    const raw = request?.headers?.[CORRELATION_ID_HEADER];
    const incoming = Array.isArray(raw) ? raw[0] : raw;
    const correlationId = normalizeCorrelationId(incoming) ?? randomUUID();

    response?.setHeader?.(CORRELATION_ID_HEADER, correlationId);

    return runWithCorrelationId(correlationId, () => next.handle());
  }
}
