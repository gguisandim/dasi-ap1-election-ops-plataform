import type { PermissionCatalogGroup } from "../types";
import styles from "../styles/access.module.css";

export function PermissionPicker({ groups, selected, onToggle, disabled = false }: {
  groups: PermissionCatalogGroup[];
  selected: string[];
  onToggle: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.permissionGroups}>
      {groups.map((group) => (
        <fieldset key={group.domain} className={styles.permissionGroup} disabled={disabled}>
          <legend>{group.label}</legend>
          {group.permissions.map((permission) => (
            <label key={permission.key} className={styles.checkbox}>
              <input type="checkbox" checked={selected.includes(permission.key)} disabled={disabled} onChange={() => onToggle(permission.key)} />
              <span>{permission.key}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
