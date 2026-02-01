/**
 * Generates a deterministic pseudo-random number based on a seed.
 * Same seed always produces the same output.
 */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}
