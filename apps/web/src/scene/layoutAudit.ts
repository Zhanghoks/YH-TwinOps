import type { Fixture, StoreLayout } from '@yh/contracts';
import { obbsOverlap, obbToQuad, obbAabb, inPolygon, type OBB } from '@storewright/overlap-audit';

export interface LayoutGap { fixtureIds: [string, string]; axis: 'x' | 'z'; gapM: number }
export interface LayoutAudit {
  fixtureCount: number;
  fixedCount: number;
  movableCount: number;
  doorIds: string[];
  overlapPairs: [string, string][];
  narrowGaps: LayoutGap[];
  /** At least one rotated footprint corner lies outside its declared zone polygon. */
  outsideZoneFixtureIds: string[];
  outsideStoreIds: string[];
  gapReviewThresholdM: number;
  warningCodes: string[];
}

/** Read-only geometry review, not route reachability, aisle clearance or regulatory certification.
 * Default bounds follow this demo's centred coordinates; caller can supply explicit bounds.
 * Gaps are only measured between axis-aligned rectangles with overlapping orthogonal projections.
 */
export function auditStoreLayout(layout: StoreLayout, options: { gapReviewThresholdM?: number; bounds?: { minX: number; minZ: number; maxX: number; maxZ: number } } = {}): LayoutAudit {
  const threshold = options.gapReviewThresholdM ?? 1;
  if (!Number.isFinite(threshold) || threshold <= 0) throw new RangeError('Review threshold must be finite and positive');
  const bounds = options.bounds ?? { minX: -layout.widthM / 2, maxX: layout.widthM / 2, minZ: -layout.depthM / 2, maxZ: layout.depthM / 2 };
  const fixedCount = layout.fixtures.filter((f) => f.fixed).length;
  const result: LayoutAudit = { fixtureCount: layout.fixtures.length, fixedCount, movableCount: layout.fixtures.length - fixedCount, doorIds: [], overlapPairs: [], narrowGaps: [], outsideZoneFixtureIds: [], outsideStoreIds: [], gapReviewThresholdM: threshold, warningCodes: ['GEOMETRY_ONLY_NOT_COMPLIANCE'] };
  const epsilon = 1e-8;
  const footprint = (f: Fixture): OBB => ({ cx: f.x, cz: f.z, ux: Math.cos(f.rotationY), uz: -Math.sin(f.rotationY), hl: f.widthM / 2, hw: f.depthM / 2 });
  const entries = layout.fixtures.map((f) => {
    const box = footprint(f);
    const aabb = obbAabb(box);
    const axisAligned = Math.abs(Math.sin(f.rotationY * 2)) < epsilon;
    if (f.fixtureType === 'DOOR') result.doorIds.push(f.fixtureId);
    if (aabb.minX < bounds.minX - epsilon || aabb.maxX > bounds.maxX + epsilon || aabb.minZ < bounds.minZ - epsilon || aabb.maxZ > bounds.maxZ + epsilon) result.outsideStoreIds.push(f.fixtureId);
    const polygon = layout.zones.find((z) => z.zoneId === f.zoneId)?.polygonM;
    if (polygon !== undefined && polygon.length >= 3) {
      const quad = obbToQuad(box);
      // inPolygon treats boundary inconsistently by edge direction, so accept exact edge points too.
      const inside = (x: number, z: number): boolean => inPolygon(x, z, polygon) || polygon.some((a, i) => {
        const b = polygon[(i + 1) % polygon.length];
        if (b === undefined) return false;
        const cross = (x - a[0]) * (b[1] - a[1]) - (z - a[1]) * (b[0] - a[0]);
        return Math.abs(cross) < epsilon && x >= Math.min(a[0], b[0]) - epsilon && x <= Math.max(a[0], b[0]) + epsilon && z >= Math.min(a[1], b[1]) - epsilon && z <= Math.max(a[1], b[1]) + epsilon;
      });
      if ([0, 2, 4, 6].some((i) => !inside(quad[i]!, quad[i + 1]!))) result.outsideZoneFixtureIds.push(f.fixtureId);
    }
    return { f, box, aabb, axisAligned };
  });
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    const a = entries[i]!, b = entries[j]!;
    if (obbsOverlap(a.box, b.box)) { result.overlapPairs.push([a.f.fixtureId, b.f.fixtureId]); continue; }
    if (!a.axisAligned || !b.axisAligned) continue;
    const dx = Math.max(a.aabb.minX, b.aabb.minX) - Math.min(a.aabb.maxX, b.aabb.maxX);
    const dz = Math.max(a.aabb.minZ, b.aabb.minZ) - Math.min(a.aabb.maxZ, b.aabb.maxZ);
    const add = (axis: 'x' | 'z', gap: number): void => { if (gap >= -epsilon && gap < threshold - epsilon) result.narrowGaps.push({ fixtureIds: [a.f.fixtureId, b.f.fixtureId], axis, gapM: Math.round(Math.max(0, gap) * 1e6) / 1e6 }); };
    if (dz < -epsilon) add('x', dx);
    if (dx < -epsilon) add('z', dz);
  }
  if (fixedCount === result.fixtureCount && fixedCount > 0) result.warningCodes.push('ALL_FIXTURES_FIXED');
  if (result.doorIds.length === 0) result.warningCodes.push('NO_DOOR_METADATA');
  if (entries.some((e) => !e.axisAligned)) result.warningCodes.push('OBLIQUE_GAPS_NOT_MEASURED');
  return result;
}
