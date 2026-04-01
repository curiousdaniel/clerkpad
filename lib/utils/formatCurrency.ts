export function formatCurrency(
  amount: number,
  currencySymbol: string = "$"
): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currencySymbol}${formatted}`;
}
