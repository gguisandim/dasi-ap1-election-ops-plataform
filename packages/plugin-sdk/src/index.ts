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

export type PluginNavigationGroup =
  | 'electoral-structure'
  | 'planning'
  | 'field-support';

export type PluginNavigationIcon =
  | 'archive'
  | 'bell'
  | 'book-open'
  | 'boxes'
  | 'calendar-clock'
  | 'chart'
  | 'clipboard-check'
  | 'file-check'
  | 'landmark'
  | 'list-todo'
  | 'map'
  | 'map-pin'
  | 'message-square'
  | 'radio-tower'
  | 'route'
  | 'scroll-text'
  | 'shield-check'
  | 'siren'
  | 'sliders'
  | 'triangle-alert'
  | 'users'
  | 'vote';

export interface PluginManifest {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: PluginCategory;
  icon: string;
  navigationGroup?: PluginNavigationGroup;
  navigationIcon?: PluginNavigationIcon;
  navigationOrder?: number;
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

export const NAVIGATION_GROUP_LABELS: Record<PluginNavigationGroup, string> = {
  'electoral-structure': 'Estrutura eleitoral',
  planning: 'Planejamento',
  'field-support': 'Campo e suporte'
};

export const NAVIGATION_GROUP_ORDER: PluginNavigationGroup[] = [
  'electoral-structure',
  'planning',
  'field-support'
];
