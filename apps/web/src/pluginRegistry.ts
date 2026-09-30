import type { PlatformPlugin } from '@eops/plugin-sdk';
import { electionsPlugin } from '@eops/plugin-elections';
import { pollingPlacesPlugin } from '@eops/plugin-polling-places';
import { routesPlugin } from '@eops/plugin-routes';
import { inventoryPlugin } from '@eops/plugin-inventory';
import { incidentsPlugin } from '@eops/plugin-incidents';
import { transmissionPlugin } from '@eops/plugin-transmission';
import { reportsPlugin } from '@eops/plugin-reports';
import { auditPlugin } from '@eops/plugin-audit';

export const plugins: PlatformPlugin[] = [
  electionsPlugin,
  pollingPlacesPlugin,
  routesPlugin,
  inventoryPlugin,
  incidentsPlugin,
  transmissionPlugin,
  reportsPlugin,
  auditPlugin
];
