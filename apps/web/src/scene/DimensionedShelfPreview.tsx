import { useEffect, useMemo } from 'react';
import { buildDimensionedShelf } from './dimensionedShelf';
import { makeDimensionedShelf, disposeDimensionedShelf } from './dimensionedShelfThree';

/** Same asset factory exported to GLB, shown only in the existing inspector Canvas. */
export function DimensionedShelfPreview({kind}: {kind:'wall'|'gondola'}) {
  const group = useMemo(()=>makeDimensionedShelf(buildDimensionedShelf(kind)),[kind]);
  useEffect(()=>()=>disposeDimensionedShelf(group),[group]);
  return <primitive object={group} />;
}
