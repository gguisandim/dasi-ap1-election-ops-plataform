import type { ComponentType } from 'react';

export type PluginCategory =
  | 'operations'
  | 'logistics'
  | 'monitoring'
  | 'analytics'
  | 'integration'
  | 'simulation'
  | 'system';

export type PluginStatus = 'stable' | 'beta' | 'experimental';

export interface PluginManifest {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: PluginCategory;
  icon: string;
  version: string;
  status: PluginStatus;
  route: string;
  permissions?: string[];
}

export interface PlatformPlugin {
  manifest: PluginManifest;
  View?: ComponentType;
  routes?: Array<{
    path: string;
    Component: ComponentType;
  }>;
}

export const CATEGORY_LABELS: Record<PluginCategory, string> = {
  operations: 'Operações',
  logistics: 'Logística',
  monitoring: 'Monitoramento',
  analytics: 'Analytics',
  integration: 'Integrações',
  simulation: 'Simulação',
  system: 'Sistema'
};
