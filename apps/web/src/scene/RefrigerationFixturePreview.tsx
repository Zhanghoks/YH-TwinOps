import { useEffect, useMemo } from 'react';
import { buildRefrigerationFixture } from './refrigerationFixture';
import { makeRefrigerationFixture, disposeRefrigerationFixture } from './refrigerationFixtureThree';

/** Same empty model used in GLB export; no merchandise and no separate Canvas. */
export function RefrigerationFixturePreview({kind}: {kind:'island'|'upright'|'open'}) {
  const group = useMemo(()=>makeRefrigerationFixture(buildRefrigerationFixture(kind)),[kind]);
  useEffect(()=>()=>disposeRefrigerationFixture(group),[group]);
  return <primitive object={group} />;
}
