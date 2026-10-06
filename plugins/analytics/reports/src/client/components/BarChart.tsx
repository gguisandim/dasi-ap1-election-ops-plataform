import type { SeriesItem } from "../../types";
import styles from "../../styles/overview.module.css";

export function BarChart({ title, data, format = String, onSelect, activeName }: { title: string; data: SeriesItem[]; format?: (value: number) => string; onSelect?: (name: string) => void; activeName?: string }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  if (data.length === 0) return <section className={styles.chart}><h3>{title}</h3><p>Sem dados no período.</p></section>;
  return <section className={styles.chart}><h3>{title}</h3>{data.map((item) => {
    const selected = activeName === item.name;
    const content = <><span title={item.name}>{item.name.replaceAll("_", " ")}</span><div><i style={{ width: `${Math.max(2, item.value / max * 100)}%` }} /></div><strong>{format(item.value)}</strong></>;
    return onSelect
      ? <button type="button" className={`${styles.barRow} ${styles.barButton} ${selected ? styles.barSelected : ""}`} key={item.name} aria-pressed={selected} onClick={() => onSelect(item.name)}>{content}</button>
      : <div className={styles.barRow} key={item.name}>{content}</div>;
  })}</section>;
}
