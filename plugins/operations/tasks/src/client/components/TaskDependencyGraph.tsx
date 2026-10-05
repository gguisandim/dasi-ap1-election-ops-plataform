import { Badge, Loading, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { tasksService } from "../services/tasksService";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "../status";
import styles from "../styles/tasks.module.css";

export function TaskDependencyGraph({ taskId }: { taskId: string }) {
  const graph = useAsync(() => tasksService.dependencies(taskId), [taskId]);
  return <section className={styles.detailPanel}>
    <div className={styles.sectionHeading}><h2>Grafo de dependências</h2>{graph.data?.blockedByDependencies && <Badge tone="danger">Bloqueada</Badge>}</div>
    {graph.loading && <Loading />}
    {graph.error && <p className={styles.inlineError}>{graph.error.message}</p>}
    {graph.data && <div className={styles.graph}>
      <div>
        <h3>Bloqueada por ({graph.data.blockedBy.length})</h3>
        <div className={styles.dependencyList}>
          {graph.data.blockedBy.map((item) => <div className={styles.dependencyRow} key={item.id}><div><Link to={`/tasks/${item.id}`}>{item.title}</Link><small>{TASK_STATUS_LABELS[item.status]} · {TASK_PRIORITY_LABELS[item.priority]}</small></div></div>)}
          {!graph.data.blockedBy.length && <p className={styles.muted}>Nenhuma dependência de entrada.</p>}
        </div>
      </div>
      <div>
        <h3>Bloqueia ({graph.data.blocks.length})</h3>
        <div className={styles.dependencyList}>
          {graph.data.blocks.map((item) => <div className={styles.dependencyRow} key={item.id}><div><Link to={`/tasks/${item.id}`}>{item.title}</Link><small>{TASK_STATUS_LABELS[item.status]} · {TASK_PRIORITY_LABELS[item.priority]}</small></div></div>)}
          {!graph.data.blocks.length && <p className={styles.muted}>Nenhuma tarefa depende desta.</p>}
        </div>
      </div>
    </div>}
  </section>;
}
