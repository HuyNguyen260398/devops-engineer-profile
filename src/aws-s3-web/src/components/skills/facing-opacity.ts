export function facingOpacity(dot: number): number {
  if (dot <= 0.1) return 0;
  return Math.min(1, Math.max(0, (dot - 0.1) * 2));
}
