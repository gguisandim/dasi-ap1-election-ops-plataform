import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'incidents',
  name: 'Central de Incidentes',
  shortName: 'Incidentes',
  description: 'Registro e tratamento de incidentes.',
  category: 'monitoring',
  icon: '!',
  version: '0.1.0',
  status: 'beta',
  route: '/incidents',
  permissions: ["incidents.read"],
};
