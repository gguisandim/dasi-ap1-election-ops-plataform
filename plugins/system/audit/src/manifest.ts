import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'audit',
  name: 'Auditoria',
  shortName: 'Auditoria',
  description: 'Rastreabilidade das alterações da plataforma.',
  category: 'system',
  icon: '≡',
  version: '0.1.0',
  status: 'beta',
  route: '/audit'
};
