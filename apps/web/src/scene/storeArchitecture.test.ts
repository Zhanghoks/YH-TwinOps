import { describe, expect, it } from 'vitest';
import { buildStoreArchitecture } from './storeArchitecture';

describe('decorative store architecture', () => {
  it('is deterministic and bounded even for large buildings', () => {
    for (const [width, depth] of [[1, 1], [20, 14], [90, 65], [1000, 1000]]) {
      const parts = buildStoreArchitecture(width!, depth!);
      expect(parts).toEqual(buildStoreArchitecture(width!, depth!));
      expect(parts.length).toBeGreaterThan(30);
      expect(parts.length).toBeLessThan(300);
      expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
      for (const p of parts) {
        expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
        p.position.forEach((v) => expect(Number.isFinite(v)).toBe(true));
        p.size.forEach((v) => { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThan(0); });
        expect(Math.abs(p.position[0]) + p.size[0] / 2).toBeLessThanOrEqual(width! / 2 + 1.5 + 1e-8);
        expect(p.position[2] + p.size[2] / 2).toBeLessThanOrEqual(depth! / 2 + 6 + 1e-8);
        expect(p.position[2] - p.size[2] / 2).toBeGreaterThanOrEqual(-depth! / 2 - 1.5 - 1e-8);
        if (!p.id.startsWith('entrance-')) expect(Math.abs(p.position[2]) + p.size[2] / 2).toBeLessThanOrEqual(depth! / 2 + 1.5 + 1e-8);
        expect(p.position[1] - p.size[1] / 2).toBeGreaterThanOrEqual(-1e-8);
        // All decoration stays outside the business floor, except thin perimeter trims.
        expect(Math.abs(p.position[0]) >= width! / 2 || Math.abs(p.position[2]) >= depth! / 2).toBe(true);
      }
    }
  });

  it('provides an open cutaway, generic red fascia, glazing, greenery and warm lights', () => {
    const parts = buildStoreArchitecture(90, 60);
    expect(parts.some((p) => p.id.includes('front-fascia') && p.color === '#b82d38')).toBe(true);
    expect(parts.some((p) => p.transparent)).toBe(true);
    expect(parts.some((p) => p.primitive === 'sphere')).toBe(true);
    expect(parts.some((p) => p.emissive)).toBe(true);
    expect(parts.some((p) => /roof|column/.test(p.id))).toBe(false);
    // Entry gaps remain open at the centre, rather than adding a fake collision wall.
    const frontSills = parts.filter((p) => p.id.startsWith('front-') && p.id.endsWith('-sill'));
    expect(frontSills.length).toBeGreaterThan(0);
    expect(frontSills.every((p) => Math.abs(p.position[0]) > 1)).toBe(true);
  });

  it('adds a paved entrance apron with an unobstructed central approach and side cart racks', () => {
    for (const [w, d] of [[1, 1], [20, 14], [90, 65]]) {
      const parts = buildStoreArchitecture(w!, d!);
      const entrance = parts.filter((p) => p.id.startsWith('entrance-'));
      expect(entrance.some((p) => p.id === 'entrance-apron')).toBe(true);
      expect(entrance.some((p) => p.id.includes('cart-rack'))).toBe(true);
      expect(entrance.some((p) => p.id.includes('planter'))).toBe(true);
      const scale = Math.min(1, w! / 8, d! / 8);
      for (const p of entrance) {
        expect(p.position[2] - p.size[2] / 2).toBeGreaterThanOrEqual(d! / 2);
        if (!/apron|paving/.test(p.id)) {
          expect(Math.abs(p.position[0]) - p.size[0] / 2).toBeGreaterThanOrEqual(Math.min(w! * .13, 4));
        }
      }
      expect(parts.find((p) => p.id === 'front-fascia')?.size[1]).toBe(scale);
    }
  });

  it('rejects invalid dimensions', () => {
    for (const bad of [0, -1, Infinity, NaN]) {
      expect(() => buildStoreArchitecture(bad, 10)).toThrow(RangeError);
      expect(() => buildStoreArchitecture(10, bad)).toThrow(RangeError);
    }
  });
});
