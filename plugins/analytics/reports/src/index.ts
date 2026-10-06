import type { PlatformPlugin } from '@eops/plugin-sdk';
import { manifest } from './manifest';
import { ReportsDashboardPage } from './client/pages/ReportsDashboardPage';
import { ReportsOperationsPage } from './client/pages/ReportsOperationsPage';
import { ReportsIncidentsPage } from './client/pages/ReportsIncidentsPage';
import { ReportsTransmissionPage } from './client/pages/ReportsTransmissionPage';
import { ReportsWorkforcePage } from './client/pages/ReportsWorkforcePage';
import { ReportsLogisticsPage } from './client/pages/ReportsLogisticsPage';
import { ReportsAssetsPage } from './client/pages/ReportsAssetsPage';
import { ReportsTimeseriesPage } from './client/pages/ReportsTimeseriesPage';
import { ReportsSlaPage } from './client/pages/ReportsSlaPage';
import { ReportsZonesPage } from './client/pages/ReportsZonesPage';
import { ReportsViewsPage } from './client/pages/ReportsViewsPage';
import { ReportsExportPage } from './client/pages/ReportsExportPage';

export const reportsPlugin: PlatformPlugin = {
  manifest,
  View: ReportsDashboardPage,
  routes: [
    { path: '/reports', Component: ReportsDashboardPage },
    { path: '/reports/operations', Component: ReportsOperationsPage },
    { path: '/reports/incidents', Component: ReportsIncidentsPage },
    { path: '/reports/transmission', Component: ReportsTransmissionPage },
    { path: '/reports/workforce', Component: ReportsWorkforcePage },
    { path: '/reports/logistics', Component: ReportsLogisticsPage },
    { path: '/reports/assets', Component: ReportsAssetsPage },
    { path: '/reports/timeseries', Component: ReportsTimeseriesPage },
    { path: '/reports/sla', Component: ReportsSlaPage },
    { path: '/reports/zones', Component: ReportsZonesPage },
    { path: '/reports/views', Component: ReportsViewsPage },
    { path: '/reports/export', Component: ReportsExportPage },
  ],
};
