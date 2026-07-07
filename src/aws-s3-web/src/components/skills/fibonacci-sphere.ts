export type SpherePoint = {
  x: number;
  y: number;
  z: number;
};

export function fibonacciSphere(count: number, radius = 1): SpherePoint[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: radius, z: 0 }];

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return Array.from({ length: count }, (_, index) => {
    const yUnit = 1 - (index / (count - 1)) * 2;
    const horizontal = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
    const theta = goldenAngle * index;

    return {
      x: Math.cos(theta) * horizontal * radius,
      y: yUnit * radius,
      z: Math.sin(theta) * horizontal * radius,
    };
  });
}
