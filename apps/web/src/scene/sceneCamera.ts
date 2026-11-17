export type CameraView = 'overview' | 'top' | 'entrance';
export function buildSceneCamera(view: CameraView, center: readonly [number, number], depth: number, width = 80): { position: [number, number, number]; target: [number, number, number] } {
  const [x, z] = center;
  const scale = Math.max(depth / 50, width / 80);
  if (view === 'entrance') return { position: [x + 12 * scale, 19 * scale, z + depth / 2 + 24 * scale], target: [x, 1.2, z + depth / 2 - 8 * scale] };
  if (view === 'top') return { position: [x, 115 * Math.max(depth / 62.5, width / 80), z + .1], target: [x, 0, z] };
  return { position: [x + 48 * scale, 64 * scale, z + 78 * scale], target: [x, 0, z] };
}
