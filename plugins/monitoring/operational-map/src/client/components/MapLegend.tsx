import styles from "../styles/map.module.css";
const items = [
  ["NORMAL", "Normal"],
  ["ATTENTION", "Atenção"],
  ["CRITICAL", "Crítico"],
  ["OFFLINE", "Offline"],
];
export function MapLegend() {
  return (
    <div className={styles.legend} aria-label="Legenda do mapa">
      {items.map(([status, label]) => (
        <span key={status}>
          <i data-status={status} />
          {label}
        </span>
      ))}
    </div>
  );
}
