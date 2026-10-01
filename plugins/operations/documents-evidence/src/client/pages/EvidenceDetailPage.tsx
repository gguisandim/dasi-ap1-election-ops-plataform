import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, ErrorState, Input, LinkButton, Loading, useAsync } from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { EvidenceStatusBadge, EvidenceTypeBadge } from "../components/EvidenceBadges";
import { EvidenceLightbox } from "../components/EvidenceLightbox";
import { EvidenceTimeline } from "../components/EvidenceTimeline";
import { EvidenceThumbnail } from "../components/EvidenceThumbnail";
import { evidenceService } from "../services/evidenceService";
import { useEvidence } from "../hooks/useEvidence";
import styles from "../styles/evidence.module.css";
import { formatBytes, formatChecksum } from "../utils/format";
import { isImageEvidenceType } from "../utils/type-guards";

/**
 * Ficha da evidência: arquivo, metadados de integridade, vínculos, timeline e
 * ações de ciclo de vida.
 */
export function EvidenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const [error, setError] = useState<Error>();

  const evidence = useEvidence(id);
  const integrity = useAsync(
    () => (id ? evidenceService.integrity(id) : Promise.resolve(undefined)),
    [id ?? ""],
  );

  if (evidence.loading) return <Loading label="Carregando evidência…" />;
  if (evidence.error) return <ErrorState error={evidence.error} onRetry={evidence.reload} />;
  const data = evidence.data;
  if (!data || !id) return <ErrorState error={new Error("Evidência não encontrada.")} />;

  const act = async (operation: () => Promise<unknown>, message: string) => {
    setError(undefined);
    setFeedback(undefined);
    try {
      await operation();
      setFeedback(message);
      evidence.reload();
      integrity.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Operação não concluída."));
    }
  };

  const download = async (versionId?: string) => {
    setDownloading(true);
    setError(undefined);
    try {
      const blob = await evidenceService.fileBlob(id, versionId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = data.version?.fileName ?? `${data.code}.bin`;
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback("Download registrado na timeline.");
      evidence.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Falha ao baixar o arquivo."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>EVIDÊNCIA {data.code}</span>
          <h1>{data.title}</h1>
          <div className={styles.badges}>
            <EvidenceTypeBadge type={data.type} />
            <EvidenceStatusBadge status={data.status} />
            {data.version && <span className={styles.chip}>v{data.version.number}</span>}
          </div>
        </div>
        <div className={styles.headerActions}>
          {isImageEvidenceType(data.type) && (
            <Button onClick={() => setZoom(true)}>
              Ampliar
            </Button>
          )}
          <Button disabled={downloading} onClick={() => void download()}>
            {downloading ? "Baixando…" : "Baixar arquivo"}
          </Button>
          <LinkButton to={`/evidence/${data.id}/versions`} secondary>
            Versões
          </LinkButton>
          <LinkButton to={`/evidence/${data.id}/edit`}>Editar</LinkButton>
        </div>
      </header>

      {error && <ErrorState error={error} />}
      {feedback && <p className={styles.successText}>{feedback}</p>}

      <div className={styles.detailGrid}>
        <Card>
          <h2>Arquivo</h2>
          <div className={styles.detailFile}>
            <EvidenceThumbnail
              evidenceId={data.id}
              type={data.type}
              extension={data.version?.extension}
              size={180}
            />
            <dl className={styles.metaList}>
              <dt>Nome original</dt>
              <dd>{data.version?.fileName ?? "—"}</dd>
              <dt>Extensão</dt>
              <dd>{data.version?.extension || "—"}</dd>
              <dt>MIME</dt>
              <dd>{data.version?.mimeType ?? "—"}</dd>
              <dt>Tamanho</dt>
              <dd>{data.version ? formatBytes(data.version.size) : "—"}</dd>
              <dt>Versão corrente</dt>
              <dd>v{data.version?.number ?? 0} de {data.versionCount}</dd>
            </dl>
          </div>

          {data.version && (
            <>
              <h3>Integridade (SHA-256)</h3>
              <code className={styles.checksumBlock}>
                {formatChecksum(data.version.checksum, 8)}
              </code>
              {integrity.data && (
                <p className={styles.mutedText}>
                  {integrity.data.available} de {integrity.data.total} versão(ões) com objeto
                  presente no armazenamento.
                  {integrity.data.missing.length > 0 && (
                    <span className={styles.dangerText}>
                      {" "}
                      Ausentes: v{integrity.data.missing.join(", v")}.
                    </span>
                  )}
                </p>
              )}
            </>
          )}

          {data.description && (
            <>
              <h2>Descrição</h2>
              <p className={styles.content}>{data.description}</p>
            </>
          )}
          {data.observations && (
            <>
              <h3>Observações internas</h3>
              <p className={styles.mutedText}>{data.observations}</p>
            </>
          )}

          <h2>Vínculos</h2>
          {data.links.length === 0 ? (
            <p className={styles.mutedText}>
              Nenhum vínculo. Sem vínculo, esta evidência não é encontrada a partir do
              registro que ela comprova.
            </p>
          ) : (
            <ul className={styles.linkList}>
              {data.links.map((link) => (
                <li key={link.id}>
                  <div>
                    <strong>{link.targetLabel ?? link.targetId}</strong>
                    <small>
                      {link.type} · {link.targetId}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className={styles.detailSide}>
          <Card>
            <h2>Procedência</h2>
            <dl className={styles.metaList}>
              <dt>Autor</dt>
              <dd>{data.authorName}</dd>
              <dt>Origem</dt>
              <dd>{data.origin ?? "—"}</dd>
              <dt>Data do fato</dt>
              <dd>
                {data.capturedAt ? formatDateTime(data.capturedAt) : "não informada"}
              </dd>
              <dt>Registrado em</dt>
              <dd>{formatDateTime(data.createdAt)}</dd>
              <dt>Atualizado em</dt>
              <dd>{formatDateTime(data.updatedAt)}</dd>
              <dt>Pleito</dt>
              <dd>{data.election?.name ?? "—"}</dd>
              <dt>Arquivado em</dt>
              <dd>{data.archivedAt ? formatDateTime(data.archivedAt) : "—"}</dd>
            </dl>

            {data.tags.length > 0 && (
              <>
                <h3>Etiquetas</h3>
                <div className={styles.tagList}>
                  {data.tags.map((tag) => (
                    <Link key={tag.id} className={styles.tag} to={`/evidence?tag=${tag.slug}`}>
                      {tag.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card>
            <h2>Ações</h2>
            <div className={styles.actions}>
              {data.status === "ACTIVE" ? (
                <Button
                  onClick={() =>
                    void act(() => evidenceService.archive(id), "Evidência arquivada.")
                  }
                >
                  Arquivar
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    void act(() => evidenceService.restore(id), "Evidência restaurada.")
                  }
                >
                  Restaurar
                </Button>
              )}

              {data.status === "ACTIVE" && data.links.length === 0 && (
                <Button
                  onClick={() => {
                    if (!window.confirm("Excluir definitivamente esta evidência?")) return;
                    setError(undefined);
                    void evidenceService
                      .remove(id)
                      .then(() => navigate("/evidence"))
                      .catch((reason: unknown) =>
                        setError(
                          reason instanceof Error
                            ? reason
                            : new Error("Não foi possível excluir."),
                        ),
                      );
                  }}
                >
                  Excluir evidência sem vínculo
                </Button>
              )}
              <small className={styles.mutedText}>
                Evidências vinculadas ou arquivadas são preservadas para auditoria.
              </small>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <h2>Timeline</h2>
        <EvidenceTimeline events={data.timeline ?? []} />
      </Card>

      <Card>
        <h2>Comparar checksum</h2>
        <ChecksumChecker expected={data.version?.checksum} />
      </Card>

      {zoom && (
        <EvidenceLightbox evidence={data} onClose={() => setZoom(false)} />
      )}
    </section>
  );
}

/**
 * Conferência de integridade pelo usuário: o checksum esperado é o que está
 * registrado; o informado é o que a pessoa obteve por fora (ex.: `sha256sum`).
 */
function ChecksumChecker({ expected }: { expected?: string }) {
  const [value, setValue] = useState("");
  const normalized = value.trim().toLowerCase();
  const verdict =
    !normalized || !expected
      ? undefined
      : normalized === expected
        ? "Íntegro: o conteúdo confere com o registro."
        : "Divergente: o conteúdo não corresponde ao registrado.";
  return (
    <div className={styles.formGrid}>
      <Input
        placeholder="Cole aqui o SHA-256 calculado do arquivo"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {verdict && (
        <p className={normalized === expected ? styles.successText : styles.dangerText}>
          {verdict}
        </p>
      )}
      {!expected && <p className={styles.mutedText}>Nenhuma versão registrada para comparar.</p>}
    </div>
  );
}
