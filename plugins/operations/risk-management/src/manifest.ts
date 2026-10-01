import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'risk-management',
  name: 'Gestão de Riscos',
  shortName: 'Riscos',
  description: 'Identificação, avaliação e mitigação de riscos do pleito.',
  category: 'operations',
  icon: '△',
  version: '0.1.0',
  status: 'beta',
  route: '/risks',
  permissions: ['risks.read'],
};
