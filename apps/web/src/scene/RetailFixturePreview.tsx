import { useEffect, useMemo } from 'react';
import { buildRetailFixture } from './retailFixture';
import { makeRetailFixture, disposeRetailFixture } from './retailFixtureThree';
/** Same empty geometry as GLB export, within the existing Canvas. */
export function RetailFixturePreview({kind}: {kind:'produce'|'service'|'checkout'}) {
  const group = useMemo(()=>makeRetailFixture(buildRetailFixture(kind)),[kind]);
  useEffect(()=>()=>disposeRetailFixture(group),[group]);
  return <primitive object={group} />;
}
