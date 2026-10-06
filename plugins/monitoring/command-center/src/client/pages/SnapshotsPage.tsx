import { useState } from "react";
import {
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LinkButton,
  Loading,
  Pagination,
  Select,
  useAsync,
} from "@eops/ui";
import { formatDateTime } from "@eops/shared/format";
import { HealthPill } from "../components/OperationalBadges";
import { useHasPermission } from "../hooks/useHasPermission";
import { commandCenterService } from "../services/commandCenterService";
import type { SnapshotComparison } from "../../types";
import styles from "../styles/command-center.module.css";

export function SnapshotsPage() {
  const canManage = useHasPermission("command-center.manage").allowed;
  const [page, setPage] = useState(1);
  const [electionId, setElectionId] = useState("");
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error>();
  const [comparison, setComparison] = useState<SnapshotComparison>();
  const [selectedId, setSelectedId] = useState<string>();

  const query = { page, pageSize: 20, electionId: electionId || undefined };
  const snapshots = useAsync(
    () => commandCenterService.snapshots(query),
    [JSON.stringify(query)],
  );
  const elections = useAsync(commandCenterService.elections, []);

  const create = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await commandCenterService.createSnapshot({
        name: form.name,
        description: form.description || undefined,
        electionId: electionId || undefined,
      });
      setForm({ name: "", description: "" });
      snapshots.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause : new Error("Não foi possível criar."),
      );
    } finally {
      setSaving(false);
    }
  };

  const compare = async (id: string) => {
    setError(undefined);
    setSelectedId(id);
    try {
      setComparison(await commandCenterService.compareSnapshot(id));
    } catch (cause) {
      setComparison(undefined);
      setError(
        cause instanceof Error ? cause : new Error("Comparação indisponível."),
      );
    }
  };

  return (
    <section className={styles.page}>
      <Breadcrumb
        items={[
          { label: "Central de Comando", to: "/command-center" },
          { label: "Snapshots" },
        ]}
      />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>REGISTRO DE SITUAÇÃO</span>
          <h1>Snapshots operacionais</h1>
          <p>
            Registro manual do estado agregado em um instante: saúde, métricas,
            itens mais relevantes e resumo por zona.
          </p>
        </div>
        <div className={styles.headerActions}>
          <LinkButton secondary to="/command-center">
            Voltar ao painel
          </LinkButton>
        </div>
      </header>

      <div className={styles.layout}>
        <Card>
          <div className={styles.sectionTitle}>
            <h2>Histórico</h2>
            <span className={styles.muted}>
              {snapshots.data ? `${snapshots.data.total} registro(s)` : "—"}
            </span>
          </div>
          <div className={styles.filters}>
            <Select
              aria-label="Pleito"
              value={electionId}
              onChange={(event) => {
                setElectionId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os pleitos</option>
              {(elections.data ?? []).map((election) => (
                <option key={election.id} value={election.id}>
                  {election.name}
                </option>
              ))}
            </Select>
          </div>
          {snapshots.loading && <Loading label="Carregando snapshots…" />}
          {snapshots.error && (
            <ErrorState error={snapshots.error} onRetry={snapshots.reload} />
          )}
          {snapshots.data?.items.length === 0 && (
            <EmptyState
              title="Nenhum snapshot registrado"
              description="Crie um snapshot para preservar o estado operacional atual."
            />
          )}
          {snapshots.data && snapshots.data.items.length > 0 && (
            <>
              <ul className={styles.viewList}>
                {snapshots.data.items.map((item) => (
                  <li key={item.id} className={styles.viewCard}>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.description ?? "Sem descrição."}</p>
                      <p className={styles.muted}>
                        {formatDateTime(item.createdAt)} ·{" "}
                        {item.createdBy.name}
                      </p>
                    </div>
                    <div className={styles.viewCardActions}>
                      <HealthPill health={item.health} />
                      <Button
                        secondary
                        onClick={() => void compare(item.id)}
                        aria-current={selectedId === item.id ? "true" : undefined}
                      >
                        Comparar com agora
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination
                page={snapshots.data.page}
                totalPages={snapshots.data.totalPages}
                onChange={setPage}
              />
            </>
          )}
        </Card>

        <div className={styles.stack}>
          <Card>
            <div className={styles.sectionTitle}>
              <h2>Comparação</h2>
              {comparison && (
                <span className={styles.muted}>
                  {comparison.snapshot.name} → agora
                </span>
              )}
            </div>
            {error && <ErrorState error={error} />}
            {!comparison && !error && (
              <p className={styles.muted}>
                Selecione um snapshot para comparar as métricas agregadas com o
                estado atual.
              </p>
            )}
            {comparison && (
              <>
                <p className={styles.muted}>
                  {comparison.snapshot.health} → {comparison.current.health}
                </p>
                <div>
                  {comparison.deltas
                    .filter((delta) => delta.delta !== 0)
                    .slice(0, 20)
                    .map((delta) => (
                      <div key={delta.key} className={styles.deltaRow}>
                        <span>{delta.key}</span>
                        <span className={styles.numeric}>{delta.before}</span>
                        <span className={styles.numeric}>{delta.after}</span>
                        <span
                          className={`${styles.numeric} ${
                            delta.delta > 0
                              ? styles.deltaPositive
                              : styles.deltaNegative
                          }`}
                        >
                          {delta.delta > 0 ? `+${delta.delta}` : delta.delta}
                        </span>
                      </div>
                    ))}
                  {comparison.deltas.every((delta) => delta.delta === 0) && (
                    <p className={styles.muted}>
                      Nenhuma métrica agregada mudou desde o snapshot.
                    </p>
                  )}
                </div>
              </>
            )}
          </Card>

          {canManage ? (
            <Card>
              <div className={styles.sectionTitle}>
                <h2>Novo snapshot</h2>
              </div>
              <div className={styles.form}>
                <Field label="Nome">
                  <Input
                    value={form.name}
                    maxLength={120}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Descrição">
                  <Input
                    value={form.description}
                    maxLength={1000}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                  />
                </Field>
                <Button
                  onClick={() => void create()}
                  disabled={saving || form.name.trim().length < 2}
                >
                  {saving ? "Registrando…" : "Registrar situação"}
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <p className={styles.unavailable}>
                Registrar snapshots exige <code>command-center.manage</code>.
              </p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
