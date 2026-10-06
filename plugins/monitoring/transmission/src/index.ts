import type { PlatformPlugin } from '@eops/plugin-sdk';
import { manifest } from './manifest';
import { TransmissionDashboardPage } from './client/pages/TransmissionDashboardPage';
import { TransmissionNocPage } from './client/pages/TransmissionNocPage';
import { TransmissionPointDetailPage } from './client/pages/TransmissionPointDetailPage';
import { TransmissionPointFormPage } from './client/pages/TransmissionPointFormPage';
import { TransmissionProvidersPage } from './client/pages/TransmissionProvidersPage';
import { TransmissionAnalyticsPage } from './client/pages/TransmissionAnalyticsPage';

export const transmissionPlugin: PlatformPlugin = {
  manifest,
  View: TransmissionDashboardPage,
  routes: [
    { path: '/transmission', Component: TransmissionDashboardPage },
    { path: '/transmission/new', Component: TransmissionPointFormPage },
    { path: '/transmission/noc', Component: TransmissionNocPage },
    { path: '/transmission/analytics', Component: TransmissionAnalyticsPage },
    { path: '/transmission/providers', Component: TransmissionProvidersPage },
    { path: '/transmission/:id', Component: TransmissionPointDetailPage },
  ],
};
