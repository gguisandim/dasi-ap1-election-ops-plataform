import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'polling-places',
  name: 'Locais de Votação',
  shortName: 'Locais',
  description: 'Zonas, seções e locais de votação.',
  category: 'operations',
  icon: '⌖',
  version: '0.1.0',
  status: 'beta',
  route: '/polling-places'
};
