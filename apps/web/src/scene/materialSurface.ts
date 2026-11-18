/** Tiny original greyscale multipliers, never real packaging, brand artwork or product data. */
export const SURFACE_KINDS = ['wood', 'brushedMetal', 'packaging', 'produce', 'produceBed', 'floorTile'] as const;
export type SurfaceKind = typeof SURFACE_KINDS[number];
export interface SurfacePixels {
  width: number;
  height: number;
  color: Uint8Array;
  roughness: Uint8Array;
  heightMap: Uint8Array;
}

/** Pure and DOM-free: three shared 64² RGBA maps per material, independent of instance count. */
export function buildSurfacePixels(kind: SurfaceKind, size = 64): SurfacePixels {
  if (!Number.isInteger(size) || size < 8 || size > 128) throw new RangeError('Surface size must be an integer from 8 to 128');
  const result: SurfacePixels = { width: size, height: size, color: new Uint8Array(size * size * 4), roughness: new Uint8Array(size * size * 4), heightMap: new Uint8Array(size * size * 4) };
  const noise = (x: number, y: number): number => {
    const n = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263);
    return ((Math.imul(n ^ (n >>> 13), 1274126177) >>> 0) & 255) / 255;
  };
  const set = (data: Uint8Array, offset: number, value: number): void => {
    const v = Math.max(0, Math.min(255, Math.round(value)));
    data[offset] = v; data[offset + 1] = v; data[offset + 2] = v; data[offset + 3] = 255;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size;
    const n = noise(x, y);
    let color = 245, roughness = 190, height = 128;
    if (kind === 'wood') {
      const grain = Math.sin((u * 12 + .22 * Math.sin(v * Math.PI * 2) + .09 * Math.sin(v * Math.PI * 6)) * Math.PI * 2);
      const fine = Math.sin(u * Math.PI * 94 + Math.sin(v * Math.PI * 2));
      color = 231 + grain * 13 + fine * 4 + n * 5;
      roughness = 192 + grain * 18 + n * 12;
      height = 128 + grain * 24 + fine * 6;
    } else if (kind === 'brushedMetal') {
      const brush = noise(x, 0);
      color = 239 + brush * 12 + n * 3;
      roughness = 94 + brush * 62 + n * 8;
      height = 128 + (brush - .5) * 12;
    } else if (kind === 'packaging') {
      const label = u > .15 && u < .85 && v > .27 && v < .7;
      const stripe = v < .10 || v > .91;
      const abstractMark = label && v > .54 && v < .63 && Math.floor(u * 28) % 3 === 0;
      color = abstractMark ? 180 : label ? 250 : stripe ? 204 : 224 + n * 8;
      roughness = label ? 178 + n * 12 : 117 + n * 18;
      height = label ? 133 : 128;
    } else if (kind === 'produceBed') {
      // Original repeated mound relief under the bounded 3D surface pieces. This is
      // illustrative produce mass, not an item count or photographic texture.
      const row = Math.floor(v * 8);
      const dx = ((u * 8 + (row % 2) * .5) % 1) - .5;
      const dy = ((v * 8) % 1) - .5;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const mound = Math.sqrt(Math.max(0, 1 - (radius / .48) ** 2));
      color = 160 + mound * 88 + n * 7;
      roughness = 185 + n * 18;
      height = 70 + mound * 150;
    } else if (kind === 'floorTile') {
      const grout = x === 0 || y === 0;
      color = grout ? 204 : 245 + n * 8;
      roughness = grout ? 228 : 168 + n * 16;
      height = grout ? 100 : 128 + n * 2;
    } else {
      color = 242 + n * 12;
      roughness = 156 + n * 35;
      height = 126 + n * 8;
    }
    const offset = (y * size + x) * 4;
    set(result.color, offset, color);
    set(result.roughness, offset, roughness);
    set(result.heightMap, offset, height);
  }
  return result;
}
