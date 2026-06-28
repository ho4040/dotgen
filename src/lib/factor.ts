/** Divisor helpers used to pick clean (integer-ratio) target sizes. */

/** All divisors of `n`, ascending. `divisors(n)` always includes 1 and n. */
export function divisors(n: number): number[] {
  const value = Math.floor(n);
  if (value < 1) return [1];
  const small: number[] = [];
  const large: number[] = [];
  for (let d = 1; d * d <= value; d++) {
    if (value % d !== 0) continue;
    small.push(d);
    const pair = value / d;
    if (pair !== d) large.push(pair);
  }
  large.reverse();
  return small.concat(large);
}

/** Pick the divisor closest to `preferred` (ties favor the smaller size). */
export function nearestDivisor(divs: readonly number[], preferred: number): number {
  let best = divs.length > 0 ? divs[0] : 1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const d of divs) {
    const dist = Math.abs(d - preferred);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}
