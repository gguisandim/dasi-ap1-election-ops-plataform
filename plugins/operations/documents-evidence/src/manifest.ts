import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'documents-evidence',
  name: 'Documentos e Evidências',
  shortName: 'Evidências',
  description: 'Acervo operacional com integridade e versionamento.',
  category: 'operations',
  navigationGroup: 'field-support',
  navigationIcon: 'file-check',
  navigationOrder: 30,
  icon: '▤',
  version: '0.1.0',
  status: 'beta',
  route: '/evidence',
  permissions: ['evidence.read'],
};
