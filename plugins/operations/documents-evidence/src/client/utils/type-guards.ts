import { EVIDENCE_IMAGE_TYPES, type EvidenceType } from "@eops/shared/evidence";

/**
 * Um tipo é "de imagem" quando o conteúdo precisa ser renderizável visualmente.
 * Espelha a regra do backend (`imageOnly`) para que a interface só busque blob
 * dos tipos em que a miniatura faz sentido.
 */
export function isImageEvidenceType(type: EvidenceType): boolean {
  return EVIDENCE_IMAGE_TYPES.includes(type);
}
