export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("he-IL");
}

export function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `₪${(n / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `₪${(n / 1_000).toFixed(0)}K`;
  }
  return `₪${Math.round(n).toLocaleString("he-IL")}`;
}
