/** Empty fixture design references, not a certified structural or manufacturing drawing.
 * Inputs use millimeters; output coordinates use meters (X across, Y up, Z toward front).
 */
export type DimensionedShelfKind = 'wall' | 'gondola';
export type ShelfDetail = 'high' | 'low';
export type ShelfVector = readonly [number, number, number];
export type ShelfFinish = 'steel' | 'deck' | 'rail' | 'plinth' | 'foot';
export interface DimensionedShelfDimensionsMm {
  width: number;
  depth: number;
  height: number;
  /** Monotonically increasing deck-top elevations. Exactly five levels. */
  levels: readonly number[];
  /** Gondola: center spine width; wall: rear post/back assembly depth. */
  spine: number;
}
interface SolidPart {
  id: string;
  finish: ShelfFinish;
  min: ShelfVector;
  max: ShelfVector;
}
export type ShelfPart = SolidPart & (
  | { type: 'box' }
  | { type: 'sheet'; cutout: { profile: 'round' | 'slot'; pitch: readonly [number, number]; size: readonly [number, number] } }
  | { type: 'bracket'; side: -1 | 1 }
);
export interface ShelfMount {
  id: string;
  side: -1 | 1;
  bay: number;
  level: number;
  /** Center of the usable shelf surface; independently modeled goods use a bottom anchor. */
  anchor: ShelfVector;
  /** Usable surface and conservative overhead clearance, in X/Y/Z order. */
  size: ShelfVector;
}
export interface DimensionedShelfModel {
  kind: DimensionedShelfKind;
  detail: ShelfDetail;
  dimensionsMm: DimensionedShelfDimensionsMm;
  parts: readonly ShelfPart[];
  mounts: readonly ShelfMount[];
}

export const DIMENSIONED_SHELF_DEFAULTS: Readonly<Record<DimensionedShelfKind, DimensionedShelfDimensionsMm>> = {
  wall: { width:2400, depth:470, height:2200, levels:[150,530,910,1290,1670], spine:50 },
  // The drawn 350 mm pitch would put the fifth deck at 1600 mm with zero headroom;
  // 300 mm is the explicit modeling assumption for the 1600 mm envelope.
  gondola: { width:2400, depth:1000, height:1600, levels:[200,500,800,1100,1400], spine:100 },
};

type Mm = [number, number, number];
const m = (v: Mm): ShelfVector => [v[0]/1000,v[1]/1000,v[2]/1000];
function positiveThickness(d: DimensionedShelfDimensionsMm): void {
  const { width,depth,height,spine,levels } = d;
  if (![width,depth,height,spine,...levels].every(n=>Number.isFinite(n)&&n>0)
    || width < 400 || depth < 260 || height > 4200 || width > 5000 || depth > 2000
    || spine < 32 || depth-spine < 200 || levels.length !== 5
    || (levels[0] ?? 0) < 110 || (levels[4] ?? Infinity) > height-165 || levels.some((n,i)=>i>0&&n-(levels[i-1] ?? 0)<150)) {
    throw new RangeError('Shelf dimensions exceed this design family or cannot fit five supported decks');
  }
}

export function buildDimensionedShelf(
  kind: DimensionedShelfKind,
  overrides: Partial<DimensionedShelfDimensionsMm> = {},
  detail: ShelfDetail = 'high',
): DimensionedShelfModel {
  const d = { ...DIMENSIONED_SHELF_DEFAULTS[kind], ...overrides };
  d.levels = [...d.levels];
  positiveThickness(d);
  const { width,depth,height,levels,spine } = d;
  const parts: ShelfPart[] = [];
  const mounts: ShelfMount[] = [];
  const wall = kind === 'wall';
  const halfWidth = width/2;
  const halfDepth = depth/2;
  const rearWall = -halfDepth;
  const frontSpine = wall ? rearWall+spine : spine/2;
  const post = 44;
  const deckThickness = 18;
  const hoodHeight = 58;
  const baseTop = levels[0] ?? 0;
  const box = (id: string, finish: ShelfFinish, min: Mm, max: Mm): void => {
    parts.push({ type:'box',id,finish,min:m(min),max:m(max) });
  };
  const sideBounds = (near: number, far: number, side: -1|1): [number,number] => side===1 ? [near,far] : [-far,-near];
  const sheet = (id: string, min: Mm, max: Mm, profile: 'round' | 'slot'): void => {
    if (detail==='low') { box(id,'steel',min,max); return; }
    parts.push({ type:'sheet',id,finish:'steel',min:m(min),max:m(max),
      cutout:profile==='round'?{profile,pitch:[.036,.036],size:[.0055,.0055]}:{profile,pitch:[.060,.05],size:[.009,.024]} });
  };

  const posts = wall ? [-halfWidth+post/2,halfWidth-post/2] : [-halfWidth+post/2,0,halfWidth-post/2];
  for (const [i,x] of posts.entries()) {
    const zBack = wall ? rearWall : -spine/2;
    const zFront = frontSpine;
    box(`post-${i}-web`,'steel',[x-post/2,8,zBack+6],[x+post/2,height,zFront-6]);
    for (const end of [-1,1] as const) {
      box(`post-${i}-flange-${end}`,'steel',[x+end*post/2-(end>0?3:0),8,zBack],
        [x+end*post/2+(end<0?3:0),height,zFront]);
    }
    const min = [x-post/2,8,zFront-2] satisfies Mm;
    const max = [x+post/2,height,zFront] satisfies Mm;
    sheet(`post-${i}-front-mounting-slots`,min,max,'slot');
    if (!wall) sheet(`post-${i}-rear-mounting-slots`,[x-post/2,8,zBack],[x+post/2,height,zBack+2],'slot');
  }

  const extents = wall ? [-halfWidth+post,halfWidth-post] : [-halfWidth+post,-post/2,post/2,halfWidth-post];
  const bays = wall ? 1 : 2;
  const baseStart = wall ? rearWall+8 : frontSpine-12;
  for (const side of (wall?[1]:[-1,1]) as readonly (-1|1)[]) {
    if (wall) {
      sheet('pegboard',[extents[0] ?? 0,baseTop,frontSpine-7],[extents[1] ?? 0,height-hoodHeight,frontSpine-3],'round');
    }
    for (let bay=0;bay<bays;bay++) {
      const a = extents[2*bay] ?? 0, b = extents[2*bay+1] ?? 0;
      if (!wall) {
        const [zl,zr] = sideBounds(frontSpine-6,frontSpine-2,side);
        box(`spine-panel-${side}-${bay}`,'steel',[a,baseTop,zl],[b,height-18,zr]);
      }
      const [base0,base1] = sideBounds(baseStart,halfDepth-10,side);
      box(`plinth-${side}-${bay}`,'plinth',[a,12,base0],[b,baseTop-deckThickness,base1]);
      for (const [i,x] of [a+12,b-12].entries()) {
        const [z0,z1] = sideBounds(halfDepth-51,halfDepth-20,side);
        box(`foot-${side}-${bay}-${i}`,'foot',[x-11,0,z0],[x+11,12,z1]);
      }
      for (const [level,y] of levels.entries()) {
        const deckBack = frontSpine;
        const deckFront = halfDepth-(level>0&&wall?16:0);
        const [z0,z1] = sideBounds(deckBack,deckFront,side);
        box(`deck-${side}-${bay}-${level}`,'deck',[a,y-deckThickness,z0],[b,y,z1]);
        const [rail0,rail1] = sideBounds(deckFront-10,deckFront,side);
        box(`rail-${side}-${bay}-${level}`,'rail',[a,y-19,rail0],[b,y+7,rail1]);
        if (level>0) {
          const [br0,br1] = sideBounds(deckBack,deckFront-21,side);
          for (const [end,x] of [a+7,b-7].entries()) {
            parts.push({ type:'bracket',id:`brace-${side}-${bay}-${level}-${end}`,finish:'steel',
              side,min:m([x-3,y-79,br0]),max:m([x+3,y-deckThickness,br1]) });
          }
        }

        // Keep the entire usable X span clear of any lateral support brackets.
        const [mountZ0,mountZ1] = sideBounds(deckBack+10,deckFront-17,side);
        const ceiling = levels[level+1] !== undefined ? (levels[level+1] ?? height)-deckThickness : height-(wall?hoodHeight:0);
        mounts.push({ id:`face-${side}-${bay}-${level}`,side,bay,level,
          anchor:m([(a+b)/2,y,(mountZ0+mountZ1)/2]),size:m([b-a-26,ceiling-y-8,mountZ1-mountZ0]) });
      }
    }
  }
  if (wall) {
    box('top-hood','rail',[-halfWidth,height-hoodHeight,rearWall],[halfWidth,height,frontSpine+Math.min(180,(depth-spine)*.62)]);
  } else {
    box('spine-cap','rail',[-halfWidth,height-18,-spine/2],[halfWidth,height,spine/2]);
  }
  return {kind,detail,dimensionsMm:d,parts,mounts};
}
