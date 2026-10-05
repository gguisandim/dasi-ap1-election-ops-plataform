import type { PlatformPlugin } from '@eops/plugin-sdk';
import { manifest } from './manifest';
import { TransmissionDashboardPage } from './client/pages/TransmissionDashboardPage';
import { TransmissionNocPage } from './client/pages/TransmissionNocPage';
import { TransmissionPointDetailPage } from './client/pages/TransmissionPointDetailPage';
import { TransmissionPointFormPage } from './client/pages/TransmissionPointFormPage';

export const transmissionPlugin: PlatformPlugin = {
  manifest,
  View: TransmissionDashboardPage,
  routes: [
    { path: '/transmission', Component: TransmissionDashboardPage },
    { path: '/transmission/new', Component: TransmissionPointFormPage },
    { path: '/transmission/noc', Component: TransmissionNocPage },
    { path: '/transmission/:id', Component: TransmissionPointDetailPage },
  ],
};
