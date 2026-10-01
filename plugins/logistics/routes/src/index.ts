import type { PlatformPlugin } from '@eops/plugin-sdk';
import { manifest } from './manifest';
import { DeliveriesPage } from './client/pages/DeliveriesPage';
import { RouteDetailPage } from './client/pages/RouteDetailPage';
import { RouteFormPage } from './client/pages/RouteFormPage';
import { RouteHistoryPage } from './client/pages/RouteHistoryPage';
import { RouteListPage } from './client/pages/RouteListPage';
import { RouteMapPage } from './client/pages/RouteMapPage';

export const routesPlugin: PlatformPlugin = {
  manifest,
  View: RouteListPage,
  routes: [
    { path: '/routes', Component: RouteListPage },
    { path: '/routes/new', Component: RouteFormPage },
    { path: '/routes/deliveries', Component: DeliveriesPage },
    { path: '/routes/map', Component: RouteMapPage },
    { path: '/routes/:id/edit', Component: RouteFormPage },
    { path: '/routes/:id/history', Component: RouteHistoryPage },
    { path: '/routes/:id', Component: RouteDetailPage },
  ],
};
