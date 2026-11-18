import { describe, expect, it } from 'vitest';
import { buildSurfacePixels, SURFACE_KINDS } from './materialSurface';

describe('original procedural surface pixels', () => {
  it('is deterministic, DOM-free and bounded for every shared surface', () => {
    for (const kind of SURFACE_KINDS) {
      const pixels = buildSurfacePixels(kind);
      expect(pixels).toEqual(buildSurfacePixels(kind));
      expect(pixels.width).toBe(64);
      expect(pixels.height).toBe(64);
      for (const map of [pixels.color, pixels.roughness, pixels.heightMap]) {
        expect(map).toBeInstanceOf(Uint8Array);
        expect(map.length).toBe(64 * 64 * 4);
        for (let i = 0; i < map.length; i += 4) {
          expect(map[i]).toBe(map[i + 1]);
          expect(map[i]).toBe(map[i + 2]);
          expect(map[i + 3]).toBe(255);
        }
      }
      // Neutral multiplicative maps preserve per-instance product and material colours.
      expect(Math.min(...pixels.color.filter((_, i) => i % 4 !== 3))).toBeGreaterThanOrEqual(160);
      expect(new Set(pixels.roughness).size).toBeGreaterThan(2);
    }
  });

  it('distinguishes wood grain, brushed metal, packaging and produce without external assets', () => {
    const textures = SURFACE_KINDS.map((kind) => [...buildSurfacePixels(kind, 16).color].join(','));
    expect(new Set(textures).size).toBe(SURFACE_KINDS.length);
    const packaging = buildSurfacePixels('packaging');
    // An abstract label band differs from package body. No real brand/SKU text is generated.
    expect(packaging.color[(32 * 64 + 32) * 4]).toBeGreaterThan(packaging.color[(4 * 64 + 32) * 4]!);
  });

  it('validates dimensions and caps allocations', () => {
    for (const size of [0, -1, 8.5, NaN, Infinity, 2048]) expect(() => buildSurfacePixels('wood', size)).toThrow(RangeError);
    expect(buildSurfacePixels('wood', 16).color.byteLength).toBe(1024);
  });
});

it('draws subtle recessed tile grout without external floor imagery', () => {
  const p = buildSurfacePixels('floorTile');
  const middle = (32*64+32)*4;
  expect(p.color[0]).toBeLessThan(p.color[middle]!);
  expect(p.heightMap[0]).toBeLessThan(p.heightMap[middle]!);
  expect(p.roughness[0]).toBeGreaterThan(p.roughness[middle]!);
});

it('gives produce beds a repeated rounded merchandise relief rather than package labels', () => {
  const bed = buildSurfacePixels('produceBed');
  expect(bed.color).not.toEqual(buildSurfacePixels('packaging').color);
  expect(Math.max(...bed.heightMap.filter((_,i)=>i%4===0))-Math.min(...bed.heightMap.filter((_,i)=>i%4===0))).toBeGreaterThan(100);
});
