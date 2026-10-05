import { OPERATIONAL_MAP_TYPES, OPERATIONAL_MAP_TYPE_LABELS, type OperationalMapFeatureType } from "../../shared/types/operational-map";
import { TYPE_GLYPHS } from "../utils/labels";
import styles from "../styles/map.module.css";

export function MapLayerToggles({ value, onChange }: { value: OperationalMapFeatureType[]; onChange: (value: OperationalMapFeatureType[]) => void }) {
  const toggle = (type: OperationalMapFeatureType) =>
    onChange(value.includes(type) ? value.filter((item) => item !== type) : [...value, type]);
  return (
    <fieldset className={styles.layers}>
      <legend>Camadas</legend>
      {OPERATIONAL_MAP_TYPES.map((type) => (
        <label key={type}>
          <input type="checkbox" checked={value.includes(type)} onChange={() => toggle(type)} />
          <span aria-hidden="true" data-type={type}>{TYPE_GLYPHS[type]}</span>
          {OPERATIONAL_MAP_TYPE_LABELS[type]}
        </label>
      ))}
    </fieldset>
  );
}
