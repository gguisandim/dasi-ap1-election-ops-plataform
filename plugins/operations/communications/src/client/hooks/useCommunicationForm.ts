import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "@eops/ui";
import type { CommunicationAudienceInput } from "@eops/shared/communications";
import { communicationService, type ReferenceData } from "../services/communicationService";
import type { CommunicationFormValue } from "../components/CommunicationForm";

export const emptyCommunicationForm: CommunicationFormValue = {
  title: "",
  content: "",
  priority: "NORMAL",
  electionId: "",
  categoryId: undefined,
  observations: undefined,
  expiresAt: undefined,
  tags: [],
  audiences: [{ type: "ALL" }],
};

/** Converte uma data ISO para o formato aceito por `datetime-local`. */
export function toLocalInput(value: string | null | undefined): string | undefined {
  return value ? new Date(value).toISOString().slice(0, 16) : undefined;
}

function fromCommunication(communication: {
  title: string;
  content: string;
  priority: CommunicationFormValue["priority"];
  electionId: string;
  categoryId: string | null;
  observations: string | null;
  expiresAt: string | null;
  tags: Array<{ label: string }>;
  audiences: Array<{
    type: CommunicationAudienceInput["type"];
    electoralZoneId: string | null;
    pollingPlaceId: string | null;
    fieldTeamId: string | null;
    fieldRoleId: string | null;
    userId: string | null;
  }>;
}): CommunicationFormValue {
  return {
    title: communication.title,
    content: communication.content,
    priority: communication.priority,
    electionId: communication.electionId,
    categoryId: communication.categoryId ?? undefined,
    observations: communication.observations ?? undefined,
    expiresAt: toLocalInput(communication.expiresAt),
    tags: communication.tags.map((tag) => tag.label),
    audiences: communication.audiences.map(
      (audience): CommunicationAudienceInput => ({
        type: audience.type,
        electoralZoneId: audience.electoralZoneId ?? undefined,
        pollingPlaceId: audience.pollingPlaceId ?? undefined,
        fieldTeamId: audience.fieldTeamId ?? undefined,
        fieldRoleId: audience.fieldRoleId ?? undefined,
        userId: audience.userId ?? undefined,
      }),
    ),
  };
}

/**
 * Estado compartilhado entre criação e edição de comunicado.
 *
 * Mantém o carregamento de dados de apoio, a hidratação do formulário a partir
 * de um comunicado existente e a gravação (rascunho, alterações ou publicação).
 */
export function useCommunicationForm(id?: string) {
  const navigate = useNavigate();
  const [form, setForm] = useState<CommunicationFormValue>(emptyCommunicationForm);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();

  const references = useAsync<ReferenceData>(() => communicationService.referenceData(), []);
  const current = useAsync(
    () => (id ? communicationService.get(id) : Promise.resolve(undefined)),
    [id ?? ""],
  );

  useEffect(() => {
    if (!current.data) return;
    setForm(fromCommunication(current.data));
    setHydrated(true);
  }, [current.data]);

  const submit = useCallback(
    async (publish: boolean) => {
      setSaving(true);
      setError(undefined);
      const expiresAt = form.expiresAt
        ? new Date(form.expiresAt).toISOString()
        : undefined;
      try {
        if (id) {
          await communicationService.update(id, {
            title: form.title,
            content: form.content,
            priority: form.priority,
            categoryId: form.categoryId,
            observations: form.observations,
            expiresAt,
            tags: form.tags,
          });
          await communicationService.replaceAudiences(id, { audiences: form.audiences });
          if (publish) await communicationService.publish(id);
          navigate(`/communications/messages/${id}`);
          return;
        }
        const created = await communicationService.create({
          ...form,
          expiresAt,
          publish,
        });
        navigate(`/communications/messages/${created.id}`);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason
            : new Error("Não foi possível salvar o comunicado."),
        );
      } finally {
        setSaving(false);
      }
    },
    [form, id, navigate],
  );

  return {
    form,
    setForm,
    references,
    current,
    hydrated,
    saving,
    error,
    submit,
    cancel: () => navigate("/communications/messages"),
  };
}
