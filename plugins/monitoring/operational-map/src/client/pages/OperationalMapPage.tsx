import { useMemo, useState } from "react";
import { EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { MapFilters } from "../components/MapFilters";
import { MapLegend } from "../components/MapLegend";
import { OperationalMap } from "../components/OperationalMap";
import {
  emptyMapFilters,
  operationalMapService,
  type MapFiltersValue,
} from "../services/operationalMapService";
import styles from "../styles/map.module.css";
export function OperationalMapPage() {
  const [filters, setFilters] = useState<MapFiltersValue>(emptyMapFilters);
  const elections = useAsync(operationalMapService.elections, []);
  const zones = useAsync(operationalMapService.zones, []);
  const allPlaces = useAsync(
    () => operationalMapService.places(emptyMapFilters),
    [],
  );
  const places = useAsync(
    () => operationalMapService.places(filters),
    [filters.electionId, filters.zoneId, filters.municipality, filters.status],
  );
  const municipalities = useMemo(
    () =>
      [...new Set((allPlaces.data ?? []).map((place) => place.city))].sort(),
    [allPlaces.data],
  );
  const loading = elections.loading || zones.loading || places.loading;
  const error = elections.error ?? zones.error ?? places.error;
  return (
    <section className={styles.page}>
      <header>
        <div>
          <span>MONITORAMENTO</span>
          <h1>Mapa Operacional</h1>
          <p>Locais georreferenciados e estados operacionais persistidos.</p>
        </div>
        <strong>{places.data?.length ?? 0} locais</strong>
      </header>
      <MapFilters
        value={filters}
        elections={elections.data ?? []}
        zones={zones.data ?? []}
        municipalities={municipalities}
        onChange={setFilters}
        onReset={() => setFilters(emptyMapFilters)}
      />
      {loading && <Loading label="Carregando mapa e locais…" />}
      {error && <ErrorState error={error} onRetry={places.reload} />}
      {!loading && !error && places.data?.length === 0 && (
        <EmptyState
          title="Mapa vazio"
          description="Nenhum local georreferenciado corresponde aos filtros."
        />
      )}
      {!loading && !error && places.data && places.data.length > 0 && (
        <>
          <OperationalMap places={places.data} />
          <MapLegend />
        </>
      )}
    </section>
  );
}
