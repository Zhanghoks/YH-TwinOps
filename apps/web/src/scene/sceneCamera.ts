export type CameraView = 'overview' | 'top' | 'entrance';
export function buildSceneCamera(view: CameraView, center: readonly [number, number], depth: number): { position: [number, number, number]; target: [number, number, number] } {
  const [x, z] = center;
  if (view === 'entrance') return { position: [x + 12, 19, z + depth / 2 + 24], target: [x, 1.2, z + depth / 2 - 8] };
  if (view === 'top') return { position: [x, 115, z + .1], target: [x, 0, z] };
  return { position: [x + 48, 64, z + 78], target: [x, 0, z] };
}
