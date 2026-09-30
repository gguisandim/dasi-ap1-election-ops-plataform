import styles from '../styles/overview.module.css';

interface Props { label: string; value: string; }

export function StatusCard({ label, value }: Props) {
  return <article className={styles.card}><span>{label}</span><strong>{value}</strong></article>;
}
