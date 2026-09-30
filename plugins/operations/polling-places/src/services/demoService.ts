import type { PluginSummary } from '../types';

export function getDemoSummary(): PluginSummary {
  return { status: 'Operacional', records: 128, alerts: 3 };
}
