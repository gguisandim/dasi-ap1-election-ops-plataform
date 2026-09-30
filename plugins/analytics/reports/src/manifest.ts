import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'reports',
  name: 'Relatórios e BI',
  shortName: 'Relatórios',
  description: 'Indicadores, relatórios e análises.',
  category: 'analytics',
  icon: '▥',
  version: '0.1.0',
  status: 'beta',
  route: '/reports'
};
