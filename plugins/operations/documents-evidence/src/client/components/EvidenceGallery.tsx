import { useState } from "react";
import type { EvidenceSummary } from "@eops/shared/evidence";
import { EvidenceCard } from "./EvidenceCard";
import { EvidenceLightbox } from "./EvidenceLightbox";
import styles from "../styles/evidence.module.css";

/**
 * Galeria de evidências visuais com navegação por teclado.
 *
 * O índice selecionado fica no componente para que o modal possa avançar e
 * retroceder sem sair da galeria.
 */
export function EvidenceGallery({ items }: { items: EvidenceSummary[] }) {
  const [selected, setSelected] = useState<number>();

  const open = (evidence: EvidenceSummary) =>
    setSelected(items.findIndex((item) => item.id === evidence.id));

  const move = (delta: number) =>
    setSelected((current) => {
      if (current === undefined) return current;
      const next = current + delta;
      return next >= 0 && next < items.length ? next : current;
    });

  const current = selected === undefined ? undefined : items[selected];

  return (
    <>
      <div className={styles.galleryGrid}>
        {items.map((evidence) => (
          <EvidenceCard key={evidence.id} evidence={evidence} onOpen={open} />
        ))}
      </div>

      {current && (
        <EvidenceLightbox
          evidence={current}
          onClose={() => setSelected(undefined)}
          onPrevious={selected !== undefined && selected > 0 ? () => move(-1) : undefined}
          onNext={
            selected !== undefined && selected < items.length - 1 ? () => move(1) : undefined
          }
        />
      )}
    </>
  );
}
