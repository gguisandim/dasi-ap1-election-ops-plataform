import { useState } from "react";
import { EmptyState, ErrorState, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { EvidenceGallery } from "../components/EvidenceGallery";
import { EvidenceFilters } from "../components/EvidenceFilters";
import { evidenceService, type EvidenceFilters as Filters } from "../services/evidenceService";
import { useEvidenceGallery } from "../hooks/useEvidence";
import styles from "../styles/evidence.module.css";

const GALLERY_TYPES = [
  { value: "PHOTO", label: "Fotografias" },
  { value: "SCREENSHOT", label: "Capturas de tela" },
] as const;

/**
 * Galeria visual: fotografias e capturas de tela em grade, com ampliação.
 *
 * O recorte é deliberado — documentos e relatórios são consultados na listagem,
 * onde checksum e vínculos aparecem lado a lado.
 */
export function EvidenceGalleryPage() {
  const [type, setType] = useState<"PHOTO" | "SCREENSHOT">("PHOTO");
  const [filters, setFilters] = useState<Filters>({ page: 1, pageSize: 24, type: "PHOTO" });
  const references = useAsync(() => evidenceService.referenceData(), []);
  const gallery = useEvidenceGallery(filters);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>EVIDÊNCIAS</span>
          <h1>Galeria</h1>
          <p>
            {gallery.data?.length ?? 0} evidência(s) visual(is). Clique para ampliar e ver
            os metadados de procedência e integridade.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Select
            aria-label="Tipo de evidência"
            value={type}
            onChange={(event) => {
              const next = event.target.value as "PHOTO" | "SCREENSHOT";
              setType(next);
              setFilters((current) => ({ ...current, type: next }));
            }}
          >
            {GALLERY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <LinkButton to="/evidence" secondary>
            Ver acervo completo
          </LinkButton>
          <LinkButton to="/evidence/new">Nova evidência</LinkButton>
        </div>
      </header>

      <EvidenceFilters
        value={filters}
        references={references.data}
        onChange={(value) => setFilters({ ...value, type })}
        onReset={() => setFilters({ page: 1, pageSize: 24, type })}
      />

      {gallery.loading && <Loading label="Carregando galeria…" />}
      {gallery.error && <ErrorState error={gallery.error} onRetry={gallery.reload} />}

      {!gallery.loading && (gallery.data?.length ?? 0) === 0 && (
        <EmptyState
          title="Galeria vazia"
          description="Nenhuma evidência visual corresponde aos filtros atuais."
          action={<LinkButton to="/evidence/new">Registrar evidência</LinkButton>}
        />
      )}

      {gallery.data && gallery.data.length > 0 && <EvidenceGallery items={gallery.data} />}
    </section>
  );
}
