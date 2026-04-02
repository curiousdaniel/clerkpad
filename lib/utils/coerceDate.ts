/**
 * IndexedDB / import paths sometimes yield dates as strings. Use before .getTime().
 */
export function toDate(
  value: Date | string | number | undefined | null
): Date | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function dateGetTime(
  value: Date | string | number | undefined | null
): number | undefined {
  const d = toDate(value);
  return d?.getTime();
}
