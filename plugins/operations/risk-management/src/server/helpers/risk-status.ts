import { RiskStatus } from "@prisma/client";

/** Máquina de estados do risco. `CLOSED` é terminal. */
export const RISK_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  IDENTIFIED: [
    RiskStatus.ASSESSED,
    RiskStatus.MITIGATING,
    RiskStatus.MONITORING,
    RiskStatus.ACCEPTED,
    RiskStatus.CLOSED,
    RiskStatus.MATERIALIZED,
  ],
  ASSESSED: [
    RiskStatus.MITIGATING,
    RiskStatus.MONITORING,
    RiskStatus.ACCEPTED,
    RiskStatus.CLOSED,
    RiskStatus.MATERIALIZED,
  ],
  MITIGATING: [
    RiskStatus.MONITORING,
    RiskStatus.ACCEPTED,
    RiskStatus.CLOSED,
    RiskStatus.MATERIALIZED,
  ],
  MONITORING: [
    RiskStatus.MITIGATING,
    RiskStatus.ACCEPTED,
    RiskStatus.CLOSED,
    RiskStatus.MATERIALIZED,
  ],
  ACCEPTED: [
    RiskStatus.MONITORING,
    RiskStatus.MITIGATING,
    RiskStatus.CLOSED,
    RiskStatus.MATERIALIZED,
  ],
  MATERIALIZED: [RiskStatus.MITIGATING, RiskStatus.MONITORING, RiskStatus.CLOSED],
  CLOSED: [],
};

export function canTransition(from: RiskStatus, to: RiskStatus): boolean {
  if (from === to) return false;
  return RISK_TRANSITIONS[from].includes(to);
}

export function transitionError(from: RiskStatus, to: RiskStatus): string {
  return `Transição de ${from} para ${to} não permitida.`;
}

/** Um risco materializado registra impacto real e data; só faz sentido uma vez. */
export function canMaterialize(status: RiskStatus): boolean {
  return status !== RiskStatus.MATERIALIZED && status !== RiskStatus.CLOSED;
}

/** Status oferecidos como escolha explícita no formulário (sem MATERIALIZED). */
export function selectableStatuses(): RiskStatus[] {
  return [
    RiskStatus.IDENTIFIED,
    RiskStatus.ASSESSED,
    RiskStatus.MITIGATING,
    RiskStatus.MONITORING,
    RiskStatus.ACCEPTED,
  ];
}
