import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'inventory',
  name: 'Inventário',
  shortName: 'Inventário',
  description: 'Equipamentos e materiais operacionais.',
  category: 'logistics',
  icon: '▤',
  version: '0.1.0',
  status: 'beta',
  route: '/inventory'
};
