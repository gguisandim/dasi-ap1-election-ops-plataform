import { useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  Loading,
  useAsync,
} from "@eops/ui";
import { STATUS_LABELS, TYPE_LABELS } from "@eops/shared";
import { Link } from "react-router-dom";
import { electionService } from "../services/electionService";
import styles from "../styles/elections.module.css";

export function ElectionListPage() {
  const { data, error, loading, reload } = useAsync(electionService.list, []);
  const [deleting, setDeleting] = useState<string>();
  async function remove(id: string, name: string) {
    if (
      !window.confirm(
        `Excluir o pleito “${name}” e toda a estrutura vinculada?`,
      )
    )
      return;
    setDeleting(id);
    try {
      await electionService.remove(id);
      reload();
    } finally {
      setDeleting(undefined);
    }
  }
  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>OPERAÇÕES</span>
          <h1>Gestão de Pleitos</h1>
          <p>Cadastre pleitos e acompanhe turnos e estrutura eleitoral.</p>
        </div>
        <LinkButton to="/elections/new">Novo pleito</LinkButton>
      </header>
      {loading && <Loading label="Carregando pleitos…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && data?.length === 0 && (
        <EmptyState
          title="Nenhum pleito cadastrado"
          description="Crie o primeiro pleito para iniciar a estrutura operacional."
          action={<LinkButton to="/elections/new">Criar pleito</LinkButton>}
        />
      )}
      {data && data.length > 0 && (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Ano</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Turnos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((election) => (
                <tr key={election.id}>
                  <td>
                    <Link to={`/elections/${election.id}`}>
                      {election.name}
                    </Link>
                  </td>
                  <td>{election.year}</td>
                  <td>{TYPE_LABELS[election.type]}</td>
                  <td>
                    <Badge
                      tone={
                        election.status === "IN_PROGRESS"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {STATUS_LABELS[election.status]}
                    </Badge>
                  </td>
                  <td>{election.rounds.length}</td>
                  <td className={styles.actions}>
                    <Link to={`/elections/${election.id}/edit`}>Editar</Link>
                    <Button
                      disabled={deleting === election.id}
                      onClick={() => void remove(election.id, election.name)}
                    >
                      Excluir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
