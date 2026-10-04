import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'transmission',
  name: 'Monitor de Transmissão',
  shortName: 'Transmissão',
  description: 'Monitoramento de pontos e eventos de transmissão.',
  category: 'monitoring',
  navigationIcon: 'radio-tower',
  icon: '◉',
  version: '0.1.0',
  status: 'beta',
  route: '/transmission',
  permissions: ['transmission.read']
};
