import { useMemo, useState } from "react";
import { EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import type { OperationalMapFeature, OperationalMapFeatureType } from "../../shared/types/operational-map";
import { MapFilters } from "../components/MapFilters";
import { MapLayerToggles } from "../components/MapLayerToggles";
import { MapLegend } from "../components/MapLegend";
import { MapSelectionPanel } from "../components/MapSelectionPanel";
import { OperationalMap } from "../components/OperationalMap";
import {
  allLayers,
  emptyMapFilters,
  operationalMapService,
  type MapFiltersValue,
} from "../services/operationalMapService";
import { statusOptionsFor } from "../utils/labels";
import styles from "../styles/map.module.css";

export function OperationalMapPage() {
  const [filters, setFilters] = useState<MapFiltersValue>(emptyMapFilters);
  const [layers, setLayers] = useState<OperationalMapFeatureType[]>(allLayers);
  const [selectedId, setSelectedId] = useState<string>();

  const zones = useAsync(operationalMapService.zones, []);
  const features = useAsync<OperationalMapFeature[]>(
    () =>
      layers.length === 0
        ? Promise.resolve([])
        : operationalMapService.features({
            ...filters,
            types: layers.length === allLayers.length ? undefined : layers,
          }),
    [filters.zoneId, filters.status, filters.severity, layers.join(",")],
  );

  const statuses = useMemo(() => statusOptionsFor(layers), [layers]);
  const data = features.data ?? [];
  const selected = data.find((feature) => feature.id === selectedId);
  const loading = zones.loading || features.loading;
  const error = zones.error ?? features.error;

  return (
    <section className={styles.page}>
      <header>
        <div>
          <span>MONITORAMENTO</span>
          <h1>Mapa Operacional</h1>
          <p>Camadas operacionais georreferenciadas por local de votação e paradas de rota.</p>
        </div>
        <strong>{data.length} features</strong>
      </header>
      <MapLayerToggles value={layers} onChange={setLayers} />
      <MapFilters
        value={filters}
        zones={zones.data ?? []}
        statuses={statuses}
        onChange={setFilters}
        onReset={() => setFilters(emptyMapFilters)}
      />
      {loading && <Loading label="Carregando mapa e features…" />}
      {error && <ErrorState error={error} onRetry={features.reload} />}
      {!loading && !error && layers.length === 0 && (
        <EmptyState title="Nenhuma camada" description="Selecione ao menos uma camada para exibir o mapa." />
      )}
      {!loading && !error && layers.length > 0 && data.length === 0 && (
        <EmptyState title="Mapa vazio" description="Nenhuma feature operacional com coordenadas corresponde aos filtros." />
      )}
      {!loading && !error && data.length > 0 && (
        <>
          <div className={`${styles.layout} ${selected ? styles.layoutWithPanel : ""}`}>
            <OperationalMap features={data} selectedId={selectedId} onSelect={(feature) => setSelectedId(feature.id)} />
            {selected && <MapSelectionPanel feature={selected} onClose={() => setSelectedId(undefined)} />}
          </div>
          <MapLegend />
        </>
      )}
    </section>
  );
}
