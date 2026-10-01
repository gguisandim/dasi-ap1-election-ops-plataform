import type { SeriesItem } from "../../types";
import styles from "../../styles/overview.module.css";

export function BarChart({ title, data, format = String }: { title: string; data: SeriesItem[]; format?: (value: number) => string }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <section className={styles.chart}><h3>{title}</h3>{data.length === 0 ? <p>Sem dados no período.</p> : data.map((item) => <div className={styles.barRow} key={item.name}><span title={item.name}>{item.name.replaceAll("_", " ")}</span><div><i style={{ width: `${Math.max(2, item.value / max * 100)}%` }} /></div><strong>{format(item.value)}</strong></div>)}</section>;
}
