import type { PluginManifest } from '@eops/plugin-sdk';

export const manifest: PluginManifest = {
  id: 'elections',
  name: 'Gestão de Pleitos',
  shortName: 'Pleitos',
  description: 'Cadastro e acompanhamento dos pleitos ativos.',
  category: 'operations',
  navigationGroup: 'electoral-structure',
  navigationIcon: 'vote',
  navigationOrder: 10,
  icon: '▣',
  version: '0.1.0',
  status: 'beta',
  route: '/elections',
  permissions: ["elections.read"],
};
