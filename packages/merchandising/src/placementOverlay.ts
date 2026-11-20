import type {ProductPlacement} from '@yh/contracts';
/** Call only after association and single-overlay validation. Never mutates seed. */
export function applyPlacementOverlay(baseline:readonly ProductPlacement[],overrides:readonly ProductPlacement[]):ProductPlacement[]{
 const changes=new Map(overrides.map(p=>[p.placementId,p]));
 return baseline.map(p=>({...changes.get(p.placementId)??p}));
}
