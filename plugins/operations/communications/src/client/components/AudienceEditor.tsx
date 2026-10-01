import { Button, Select } from "@eops/ui";
import {
  COMMUNICATION_AUDIENCE_LABELS,
  type CommunicationAudienceInput,
  type CommunicationAudienceType,
} from "@eops/shared/communications";
import type { ReferenceData } from "../services/communicationService";
import styles from "../styles/communications.module.css";
import { AUDIENCE_ICONS, AUDIENCE_ORDER } from "../utils/presentation";

type AudienceTargetField =
  | "electoralZoneId"
  | "pollingPlaceId"
  | "fieldTeamId"
  | "fieldRoleId"
  | "userId";

const TARGET_FIELD: Record<
  Exclude<CommunicationAudienceType, "ALL">,
  AudienceTargetField
> = {
  ELECTORAL_ZONE: "electoralZoneId",
  POLLING_PLACE: "pollingPlaceId",
  FIELD_TEAM: "fieldTeamId",
  OPERATIONAL_ROLE: "fieldRoleId",
  USER: "userId",
};

function optionsFor(type: CommunicationAudienceType, references: ReferenceData) {
  switch (type) {
    case "ELECTORAL_ZONE":
      return references.zones.map((zone) => ({
        id: zone.id,
        label: `Zona ${zone.number} · ${zone.name}`,
      }));
    case "POLLING_PLACE":
      return references.places.map((place) => ({
        id: place.id,
        label: `${place.name} — ${place.city}`,
      }));
    case "FIELD_TEAM":
      return references.teams.map((team) => ({
        id: team.id,
        label: `${team.code} · ${team.name}`,
      }));
    case "OPERATIONAL_ROLE":
      return references.roles.map((role) => ({ id: role.id, label: role.name }));
    case "USER":
      return references.users.map((user) => ({
        id: user.id,
        label: `${user.name} (${user.email})`,
      }));
    default:
      return [];
  }
}

/**
 * Editor de direcionamento.
 *
 * Cada linha é uma regra tipada. `ALL` não possui alvo; os demais tipos exigem
 * exatamente um alvo, o que mantém a resolução de destinatários determinística.
 */
export function AudienceEditor({
  value,
  references,
  onChange,
}: {
  value: CommunicationAudienceInput[];
  references: ReferenceData;
  onChange: (audiences: CommunicationAudienceInput[]) => void;
}) {
  const add = () => onChange([...value, { type: "ALL" }]);

  const update = (index: number, audience: CommunicationAudienceInput) =>
    onChange(value.map((current, position) => (position === index ? audience : current)));

  const remove = (index: number) =>
    onChange(value.filter((_, position) => position !== index));

  const changeType = (index: number, type: CommunicationAudienceType) => {
    const next: CommunicationAudienceInput = { type };
    const target = type === "ALL" ? null : TARGET_FIELD[type];
    if (target) {
      const options = optionsFor(type, references);
      if (options[0]) next[target] = options[0].id;
    }
    update(index, next);
  };

  const changeTarget = (index: number, type: CommunicationAudienceType, targetId: string) => {
    const audience: CommunicationAudienceInput = { type };
    if (type !== "ALL") audience[TARGET_FIELD[type]] = targetId;
    update(index, audience);
  };

  return (
    <div className={styles.audienceEditor}>
      <div className={styles.sectionTitle}>
        <h2>Direcionamento</h2>
        <Button type="button" onClick={add}>
          Adicionar destino
        </Button>
      </div>
      {value.length === 0 && (
        <p className={styles.mutedText}>
          Nenhum destino definido. Um comunicado precisa de ao menos um direcionamento
          para ser publicado.
        </p>
      )}
      {value.map((audience, index) => {
        const options = optionsFor(audience.type, references);
        const target = audience.type === "ALL" ? null : TARGET_FIELD[audience.type];
        return (
          <div className={styles.audienceRow} key={`${audience.type}-${index}`}>
            <span className={styles.audienceIcon} aria-hidden="true">
              {AUDIENCE_ICONS[audience.type]}
            </span>
            <Select
              aria-label="Tipo de destino"
              value={audience.type}
              onChange={(event) =>
                changeType(index, event.target.value as CommunicationAudienceType)
              }
            >
              {AUDIENCE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {COMMUNICATION_AUDIENCE_LABELS[type]}
                </option>
              ))}
            </Select>
            {target ? (
              <Select
                aria-label="Destino"
                value={String(audience[target] ?? "")}
                onChange={(event) => changeTarget(index, audience.type, event.target.value)}
              >
                <option value="">Selecione…</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <span className={styles.audienceHint}>
                Alcança todos os usuários ativos e as equipes ativas
              </span>
            )}
            <Button type="button" onClick={() => remove(index)}>
              Remover
            </Button>
          </div>
        );
      })}
    </div>
  );
}

/** Resumo somente-leitura de regras já persistidas. */
export function AudienceList({
  audiences,
  references,
}: {
  audiences: Array<{
    id: string;
    type: CommunicationAudienceType;
    electoralZoneId: string | null;
    pollingPlaceId: string | null;
    fieldTeamId: string | null;
    fieldRoleId: string | null;
    userId: string | null;
  }>;
  references: ReferenceData;
}) {
  if (audiences.length === 0) {
    return <p className={styles.mutedText}>Nenhum direcionamento definido.</p>;
  }
  const describe = (audience: (typeof audiences)[number]) => {
    const find = <T extends { id: string }>(items: T[], id: string | null) =>
      items.find((item) => item.id === id);
    switch (audience.type) {
      case "ALL":
        return "Todos os usuários ativos e equipes ativas";
      case "ELECTORAL_ZONE": {
        const zone = find(references.zones, audience.electoralZoneId);
        return zone ? `Zona ${zone.number} · ${zone.name}` : "Zona removida";
      }
      case "POLLING_PLACE": {
        const place = find(references.places, audience.pollingPlaceId);
        return place ? `${place.name} — ${place.city}` : "Local removido";
      }
      case "FIELD_TEAM": {
        const team = find(references.teams, audience.fieldTeamId);
        return team ? `${team.code} · ${team.name}` : "Equipe removida";
      }
      case "OPERATIONAL_ROLE": {
        const role = find(references.roles, audience.fieldRoleId);
        return role ? `Função ${role.name}` : "Função removida";
      }
      case "USER": {
        const user = find(references.users, audience.userId);
        return user ? user.name : "Usuário removido";
      }
      default:
        return audience.type;
    }
  };
  return (
    <ul className={styles.audienceList}>
      {audiences.map((audience) => (
        <li key={audience.id}>
          <span aria-hidden="true">{AUDIENCE_ICONS[audience.type]}</span>
          <div>
            <strong>{COMMUNICATION_AUDIENCE_LABELS[audience.type]}</strong>
            <small>{describe(audience)}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}
