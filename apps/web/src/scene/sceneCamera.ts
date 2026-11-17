export type CameraView = 'overview' | 'top' | 'entrance';
export function buildSceneCamera(view: CameraView, center: readonly [number, number], depth: number, width = 80): { position: [number, number, number]; target: [number, number, number] } {
  const [x, z] = center;
  const scale = Math.max(depth / 50, width / 80);
  if (view === 'entrance') return { position: [x + 12 * scale, 19 * scale, z + depth / 2 + 24 * scale], target: [x, 1.2, z + depth / 2 - 8 * scale] };
  if (view === 'top') return { position: [x, (width === 130 && depth === 100 ? 166.25 : 115 * Math.max(depth / 62.5, width / 80)), z + .1], target: [x, 0, z] };
  return { position: [x + 48 * scale, 64 * scale, z + 78 * scale], target: [x, 0, z] };
}

/** Fit the floor to the actual canvas, reserving room for the top/bottom controls. */
export function fitTopViewHeight(widthM: number, depthM: number, viewportWidth: number, viewportHeight: number, fov = 42): number {
  const h = Math.max(1, viewportHeight), w = Math.max(1, viewportWidth);
  const usableW = Math.max(w * .6, w - 48), usableH = Math.max(h * .6, h - 150);
  const tan = Math.tan(fov * Math.PI / 360);
  return Math.max((widthM + 6) * h / (2 * tan * usableW), (depthM + 6) * h / (2 * tan * usableH));
}
