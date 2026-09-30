import { StatusCard } from '../components/StatusCard';
import { getDemoSummary } from '../services/demoService';
import styles from '../styles/overview.module.css';

export function View() {
  const summary = getDemoSummary();

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.tag}>operations</span>
        <h1>Gestão de Pleitos</h1>
        <p>Gerencie pleitos, turnos, períodos operacionais e parâmetros globais da eleição.</p>
      </header>
      <div className={styles.cardGrid}>
        <StatusCard label="Status" value={summary.status} />
        <StatusCard label="Registros" value={String(summary.records)} />
        <StatusCard label="Alertas" value={String(summary.alerts)} />
      </div>
      <article className={styles.tableCard}>
        <div className={styles.tableHead}><strong>Área de trabalho</strong><span>Dados demonstrativos</span></div>
        <div className={styles.emptyState}>Este módulo está isolado e pronto para receber novas páginas, serviços, componentes e endpoints.</div>
      </article>
    </section>
  );
}
