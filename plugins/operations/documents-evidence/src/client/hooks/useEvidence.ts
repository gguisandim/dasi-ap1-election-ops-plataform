import { useCallback, useEffect, useRef, useState } from "react";
import { useAsync } from "@eops/ui";
import {
  evidenceService,
  type EvidenceFilters,
  type EvidenceUploadInput,
} from "../services/evidenceService";

export function useEvidenceList(filters: EvidenceFilters) {
  const key = JSON.stringify(filters);
  return useAsync(() => evidenceService.list(filters), [key]);
}

export function useEvidenceGallery(filters: EvidenceFilters) {
  const key = JSON.stringify(filters);
  return useAsync(() => evidenceService.gallery(filters), [key]);
}

export function useEvidenceDashboard(electionId?: string) {
  return useAsync(() => evidenceService.dashboard(electionId), [electionId ?? ""]);
}

export function useEvidence(id: string | undefined) {
  return useAsync(
    () => (id ? evidenceService.get(id) : Promise.resolve(undefined)),
    [id ?? ""],
  );
}

export function useEvidenceReferenceData() {
  return useAsync(() => evidenceService.referenceData(), []);
}

/**
 * URL de objeto para o conteúdo binário de uma versão.
 *
 * O arquivo exige o cabeçalho `Authorization`, então não pode ser usado direto
 * em `src`: baixamos o blob autenticado e criamos uma URL temporária. A URL
 * anterior é revogada para não vazar memória entre navegações.
 */
export function useEvidenceBlobUrl(evidenceId?: string, versionId?: string) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(false);
  const current = useRef<string | undefined>(undefined);

  const revoke = useCallback(() => {
    if (current.current) {
      URL.revokeObjectURL(current.current);
      current.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (!evidenceId) return undefined;
    let active = true;
    setLoading(true);
    setError(undefined);

    evidenceService
      .fileBlob(evidenceId, versionId)
      .then((blob) => {
        if (!active) return;
        revoke();
        const objectUrl = URL.createObjectURL(blob);
        current.current = objectUrl;
        setUrl(objectUrl);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason : new Error("Falha ao carregar o arquivo."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      revoke();
    };
  }, [evidenceId, versionId, revoke]);

  useEffect(() => revoke, [revoke]);

  return { url, loading, error };
}

/**
 * Estado de envio do formulário de evidência.
 * Concentra validação local de tamanho/tipo antes de tocar a rede.
 */
export function useEvidenceUpload() {
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error>();

  const upload = useCallback(
    async (input: EvidenceUploadInput, file: File, maxBytes: number, imageOnly: boolean) => {
      setError(undefined);
      if (file.size <= 0) {
        setError(new Error("O arquivo selecionado está vazio."));
        return undefined;
      }
      if (file.size > maxBytes) {
        setError(new Error("O arquivo excede o limite permitido para este tipo."));
        return undefined;
      }
      if (imageOnly && !file.type.startsWith("image/")) {
        setError(new Error("Este tipo de evidência aceita apenas imagens."));
        return undefined;
      }

      setPending(true);
      setProgress(10);
      try {
        const timer = setInterval(
          () => setProgress((value) => (value < 90 ? value + 10 : value)),
          180,
        );
        try {
          const result = await evidenceService.create(input, file);
          setProgress(100);
          return result;
        } finally {
          clearInterval(timer);
        }
      } catch (reason) {
        setError(
          reason instanceof Error ? reason : new Error("Não foi possível enviar a evidência."),
        );
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { upload, pending, progress, error, setError };
}
