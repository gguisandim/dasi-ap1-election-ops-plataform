import { useState } from "react";
import { Button, Input, Select } from "@eops/ui";
import { EVIDENCE_LINK_LABELS, EVIDENCE_LINK_TYPES, type EvidenceLinkType } from "@eops/shared/evidence";
import styles from "../styles/evidence.module.css";
import { LINK_ICONS } from "../utils/presentation";

/** Converte `"INCIDENT:abc"` em par tipado. */
export function parseLinkToken(token: string): { type: EvidenceLinkType; targetId: string } | null {
  const separator = token.indexOf(":");
  if (separator <= 0) return null;
  const type = token.slice(0, separator) as EvidenceLinkType;
  const targetId = token.slice(separator + 1).trim();
  if (!targetId || !EVIDENCE_LINK_TYPES.includes(type)) return null;
  return { type, targetId };
}

/**
 * Editor de vínculos por identificador opaco.
 *
 * O formulário de upload é multipart, então os vínculos viajam como texto no
 * formato `TIPO:identificador`. A validação de existência é do backend, que
 * também resolve o rótulo legível de cada alvo.
 */
export function EvidenceLinkEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tokens: string[]) => void;
}) {
  const [type, setType] = useState<EvidenceLinkType>("INCIDENT");
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string>();

  const add = () => {
    const trimmed = targetId.trim();
    if (!trimmed) {
      setError("Informe o identificador do registro.");
      return;
    }
    const token = `${type}:${trimmed}`;
    if (value.includes(token)) {
      setError("Este vínculo já foi adicionado.");
      return;
    }
    onChange([...value, token]);
    setTargetId("");
    setError(undefined);
  };

  return (
    <div className={styles.linkEditor}>
      <div className={styles.sectionTitle}>
        <h2>Vínculos operacionais</h2>
        <small className={styles.mutedText}>
          Use o identificador do registro. Sem vínculo, a evidência não é encontrada
          a partir do incidente, local ou entrega.
        </small>
      </div>

      <div className={styles.linkRow}>
        <Select
          aria-label="Tipo de registro"
          value={type}
          onChange={(event) => setType(event.target.value as EvidenceLinkType)}
        >
          {EVIDENCE_LINK_TYPES.map((item) => (
            <option key={item} value={item}>
              {EVIDENCE_LINK_LABELS[item]}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Identificador do registro"
          placeholder="Identificador do registro"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        />
        <Button type="button" onClick={add}>
          Adicionar vínculo
        </Button>
      </div>

      {error && <p className={styles.dangerText}>{error}</p>}

      {value.length === 0 ? (
        <p className={styles.mutedText}>Nenhum vínculo informado.</p>
      ) : (
        <ul className={styles.linkList}>
          {value.map((token) => {
            const parsed = parseLinkToken(token);
            return (
              <li key={token}>
                <span aria-hidden="true">{parsed ? LINK_ICONS[parsed.type] : "•"}</span>
                <div>
                  <strong>{parsed ? EVIDENCE_LINK_LABELS[parsed.type] : "Vínculo"}</strong>
                  <small>{parsed?.targetId ?? token}</small>
                </div>
                <Button
                  type="button"
                  onClick={() => onChange(value.filter((item) => item !== token))}
                >
                  Remover
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
