import type { PlatformPlugin } from '@eops/plugin-sdk';
import { manifest } from './manifest';
import { View } from './pages/Overview';

export const auditPlugin: PlatformPlugin = { manifest, View };
