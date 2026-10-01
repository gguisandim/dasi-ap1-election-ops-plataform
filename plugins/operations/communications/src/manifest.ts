import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'communications',
  name: 'Comunicações Operacionais',
  shortName: 'Comunicações',
  description: 'Comunicados oficiais, direcionamento e confirmação de leitura.',
  category: 'operations',
  icon: '✉',
  version: '0.1.0',
  status: 'beta',
  route: '/communications',
  permissions: ['communications.read'],
};
