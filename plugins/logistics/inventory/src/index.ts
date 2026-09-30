import type { PlatformPlugin } from '@eops/plugin-sdk';
import { manifest } from './manifest';
import { View } from './pages/Overview';

export const inventoryPlugin: PlatformPlugin = { manifest, View };
