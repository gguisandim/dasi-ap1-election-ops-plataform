import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'routes',
  name: 'Rotas e Distribuição',
  shortName: 'Rotas',
  description: 'Planejamento logístico de rotas e entregas.',
  category: 'logistics',
  icon: '⇢',
  version: '0.1.0',
  status: 'beta',
  route: '/routes',
  permissions: ['routes.read']
};
