/** Lightweight replacements for d3-array (extent, bisector, mean) */

/** Returns [min, max] of values extracted by accessor, or of the array directly. */
export function extent<T>(
  values: T[],
  accessor?: (d: T) => number | null | undefined,
): [number, number] | [undefined, undefined] {
  let min: number | undefined;
  let max: number | undefined;
  for (const v of values) {
    const n = accessor ? accessor(v) : (v as unknown as number);
    if (n == null || !Number.isFinite(n)) continue;
    if (min === undefined || n < min) min = n;
    if (max === undefined || n > max) max = n;
  }
  return min !== undefined && max !== undefined ? [min, max] : [undefined, undefined];
}

/** Returns mean of values extracted by accessor. */
export function mean<T>(values: T[], accessor: (d: T) => number | null | undefined): number | undefined {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    const n = accessor(v);
    if (n != null && Number.isFinite(n)) {
      sum += n;
      count++;
    }
  }
  return count > 0 ? sum / count : undefined;
}

/** Binary search: returns index where value would be inserted (left side). */
export function bisectLeft<T>(
  array: T[],
  value: Date | number,
  accessor: (d: T) => Date | number,
): number {
  let lo = 0;
  let hi = array.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const mv = accessor(array[mid]);
    if ((mv instanceof Date ? mv.getTime() : mv) < (value instanceof Date ? value.getTime() : value)) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}
