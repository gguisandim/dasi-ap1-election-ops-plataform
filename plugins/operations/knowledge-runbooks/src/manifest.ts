import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'knowledge-runbooks',
  name: 'Base de Conhecimento',
  shortName: 'Conhecimento',
  description: 'Procedimentos, runbooks e soluções conhecidas.',
  category: 'operations',
  icon: '❖',
  version: '0.1.0',
  status: 'beta',
  route: '/knowledge',
  permissions: ['knowledge.read'],
};
