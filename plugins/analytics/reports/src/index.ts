import type { PlatformPlugin } from '@eops/plugin-sdk';
import { manifest } from './manifest';
import { ReportsDashboardPage } from './client/pages/ReportsDashboardPage';

export const reportsPlugin: PlatformPlugin = { manifest, View: ReportsDashboardPage, routes: [{ path: '/reports', Component: ReportsDashboardPage }] };
