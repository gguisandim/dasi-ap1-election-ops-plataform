export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}
