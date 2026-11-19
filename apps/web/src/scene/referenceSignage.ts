import type { Fixture } from '@yh/contracts';
/** Spatial display ordinals, not replacements for operational fixture IDs or POS identities. */
export function buildReferenceCheckoutSigns(fixtures: readonly Fixture[]) {
  return fixtures.filter((f) => f.fixtureType === 'CHECKOUT').sort((a,b) => a.x-b.x).map((f,i) => ({
    fixtureId: f.fixtureId, text: String(i+1).padStart(2,'0'),
    position: [f.x,2.5,35.2] as [number,number,number],
  }));
}
