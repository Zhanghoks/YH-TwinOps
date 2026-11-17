import { describe, expect, it } from 'vitest';
import { layout as baseline } from '../data';
import { generatePlanningLayout } from './planningLayout';
import { buildReferenceCheckoutSigns } from './referenceSignage';
describe('reference checkout display ordinals', () => {
  it('numbers the 24 spatial lanes without rewriting or reordering operational fixture records', () => {
    const {layout} = generatePlanningLayout(baseline);
    const before = JSON.stringify(layout);
    const signs = buildReferenceCheckoutSigns(layout.fixtures);
    expect(signs).toHaveLength(24);
    expect(signs.map((s) => s.text)).toEqual(Array.from({length:24},(_,i)=>String(i+1).padStart(2,'0')));
    expect(new Set(signs.map((s) => s.fixtureId)).size).toBe(24);
    expect(signs.every((s) => layout.fixtures.some((f)=> f.fixtureId === s.fixtureId))).toBe(true);
    expect(signs.map((s)=>s.position[0])).toEqual(signs.map((s)=>s.position[0]).sort((a,b)=>a-b));
    expect(JSON.stringify(layout)).toBe(before);
  });
});
