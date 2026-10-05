import { IsOptional, IsString } from "class-validator";
import { ReportQueryDto } from "./report-query.dto";

// Filtro específico do domínio de incidentes (severidade); os demais campos vêm do contrato compartilhado.
export class IncidentsReportQueryDto extends ReportQueryDto {
  @IsString() @IsOptional() severity?: string;
}
