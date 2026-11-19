/** Original procedural display assets. Dimensions are meters; none are measured SKU records. */
import type { DetailFixtureShape, DetailMaterial, DetailPart, DetailPrimitive } from './detailGeometry';

const COLORS = { metal: '#c4cbd0', white: '#e9e9e2', trim: '#58756a' };
const PACKS = ['#b75e48', '#d9ae58', '#729b8c', '#e1d3ac', '#698ba1', '#bc927c'];
type MerchandisingStyle = 'mixed' | 'beverages' | 'household' | 'packaged' | 'bulk';
interface MerchandisingTheme { style: MerchandisingStyle; accent: string; panel: string; palette: string[] }
/** Zone colours are semantic, stable across fixture IDs; no real brand or SKU mapping. */
export function merchandisingTheme(zoneId: string): MerchandisingTheme {
  switch (zoneId) {
    case 'zone-beverages': return { style: 'beverages', accent: '#496c77', panel: '#cad9d9', palette: ['#799c94', '#5d8191', '#bca36b', '#d0c6a8'] };
    case 'zone-household': return { style: 'household', accent: '#68738d', panel: '#d9dde5', palette: ['#94afbd', '#bbc8c0', '#8f9ab1', '#dddacb'] };
    case 'zone-packaged': return { style: 'packaged', accent: '#a16b4e', panel: '#ddc9b4', palette: ['#b76d4f', '#d1ad63', '#d8c7a3', '#8d9a71'] };
    case 'zone-bulk': return { style: 'bulk', accent: '#92734d', panel: '#b39a73', palette: ['#c4b18a', '#d7c6a4', '#a39470', '#d4b57c'] };
    default: return { style: 'mixed', accent: COLORS.trim, panel: '#d5dcd6', palette: PACKS };
  }
}

type Vec3 = [number, number, number];
export type MerchandiseModel = 'carton' | 'pouch' | 'jar' | 'bottle' | 'detergent' | 'tissue' | 'sack';
export interface ShelfSlot {
  readonly id: string;
  readonly level: number;
  /** Facing sign on the rack's display axis, which is local Z except for swapped narrow beverage racks. */
  readonly side: -1 | 1;
  readonly col: number;
  /** Bottom-centre on the shelf surface, in fixture-local coordinates. */
  readonly anchor: Vec3;
  readonly cellSize: Vec3;
  readonly modelSize: Vec3;
  readonly swapsAxes: boolean;
  readonly model: MerchandiseModel;
  readonly color: string;
}

const LEVELS = 4;
const SHELF_THICKNESS = .026;
const shelfCentre = (level: number): number => .13 + level * .205;
const shelfTop = (level: number): number => shelfCentre(level) + SHELF_THICKNESS / 2;
const swapsAxes = (f: DetailFixtureShape): boolean =>
  f.fixtureType === 'FREEZER' && f.zoneId === 'zone-beverages' && f.depthM > f.widthM * 2;

export function supportsShelfPlanogram(f: DetailFixtureShape): boolean {
  return f.designVariant === undefined && (f.fixtureType === 'GONDOLA' || swapsAxes(f));
}

function shelfDimensions(f: DetailFixtureShape): Vec3 {
  if (![f.widthM, f.heightM, f.depthM].every(n => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Fixture dimensions must be finite and positive');
  }
  return swapsAxes(f) ? [f.depthM, f.heightM, f.widthM] : [f.widthM, f.heightM, f.depthM];
}

function fixtureAxes(v: Vec3, swap: boolean): Vec3 {
  return swap ? [v[2], v[1], v[0]] : v;
}

/** The bare fixture has no SKU parts, label faces or stock markers. */
export function buildShelfStructure(f: DetailFixtureShape): DetailPart[] {
  if (!supportsShelfPlanogram(f)) return [];
  const dims = shelfDimensions(f);
  const swap = swapsAxes(f);
  const parts: DetailPart[] = [];
  const theme = merchandisingTheme(f.zoneId);
  const panels: DetailMaterial = theme.style === 'bulk' ? 'wood' : 'metal';
  const scale = (v: Vec3): Vec3 => fixtureAxes([v[0] * dims[0], v[1] * dims[1], v[2] * dims[2]], swap);
  const add = (id: string, at: Vec3, size: Vec3, color: string, material: DetailMaterial = 'metal'): void => {
    parts.push({ id, primitive: 'box', position: scale(at), size: scale(size), color, material });
  };

  add('plinth', [0, .045, 0], [.98, .09, .96], theme.accent, panels);
  add('central-spine', [0, .52, 0], [.95, .92, .035], COLORS.white);
  for (const side of [-1, 1]) {
    add(`upright-${side}`, [side * .47, .52, 0], [.025, .96, .055], COLORS.metal);
    add(`end-panel-${side}`, [side * .485, .47, 0], [.02, .76, .66], theme.panel, panels);
    add(`department-band-${side}`, [side * .497, .78, 0], [.006, .08, .66], theme.accent);
  }
  for (let level = 0; level < LEVELS; level++) {
    const y = shelfCentre(level);
    add(`shelf-${level}`, [0, y, 0], [.96, SHELF_THICKNESS, .93], COLORS.white);
    for (const side of [-1, 1]) {
      add(`price-rail-${level}-${side}`, [0, y + .015, side * .468], [.95, .035, .018], theme.accent);
    }
  }
  add('top-cap', [0, .985, 0], [.98, .03, .065], COLORS.metal);
  return parts;
}

const assortment: Record<MerchandisingStyle, readonly (readonly MerchandiseModel[])[]> = {
  packaged: [['carton','pouch','jar'], ['jar','carton','pouch'], ['carton','carton','jar'], ['pouch','carton','pouch']],
  household: [['detergent','bottle','detergent'], ['detergent','detergent','tissue'], ['bottle','detergent','bottle'], ['tissue','tissue','bottle']],
  beverages: [['bottle','bottle','bottle','carton'], ['bottle','bottle','jar'], ['bottle','carton','bottle'], ['jar','bottle','bottle']],
  bulk: [['sack','sack','carton'], ['carton','sack','sack'], ['sack','sack','jar'], ['sack','carton','sack']],
  mixed: [['carton','bottle','jar'], ['bottle','carton','pouch'], ['tissue','jar','carton'], ['carton','pouch','bottle']],
};

/** Maximum physical item dimensions (w/h/d). A tighter shelf cell shrinks dimensions only as needed. */
const envelopes: Record<MerchandiseModel, Vec3> = {
  carton: [.26,.29,.15], pouch: [.21,.25,.12], jar: [.17,.185,.17], bottle: [.155,.29,.145],
  detergent: [.25,.35,.16], tissue: [.30,.15,.21], sack: [.26,.26,.19],
};

export function buildShelfPlanogram(f: DetailFixtureShape): ShelfSlot[] {
  if (!supportsShelfPlanogram(f)) return [];
  const [width, height, depth] = shelfDimensions(f);
  const swap = swapsAxes(f);
  const theme = merchandisingTheme(f.zoneId);
  // Metre-sized fixtures use physically sized repeat facings; a long rack is not a
  // stretched version of the six-item inspector sample. Cap pathological inputs.
  const bays = Math.min(40, Math.max(3, Math.round(width / (width <= 1.6 ? .2 : .24))));
  const seed = [...f.fixtureId].reduce((n,c) => (Math.imul(n,31) + c.charCodeAt(0)) >>> 0, 0);
  const slots: ShelfSlot[] = [];

  for (const [level,row] of assortment[theme.style].entries()) {
    for (const side of [-1, 1] as const) {
      for (let col = 0; col < bays; col++) {
        // Small blocks of like products read as facings, not a random assortment at every slot.
        const block = Math.floor(col * 3 / bays);
        const index = (block + seed % row.length + (side < 0 ? 1 : 0)) % row.length;
        const model = row[index] ?? 'carton';
        const cell: Vec3 = [.88 * width / bays, (level < LEVELS - 1 ? .179 : 1 - shelfTop(level)) * height, .37 * depth];
        const item = envelopes[model];
        slots.push({
          id: `${level}-${side}-${col}`, level, side, col, swapsAxes: swap,
          anchor: fixtureAxes([(col + .5 - bays / 2) * cell[0], shelfTop(level) * height, side * .245 * depth], swap),
          cellSize: fixtureAxes(cell, swap),
          modelSize: [Math.min(item[0], cell[0] * .88), Math.min(item[1], cell[1] * .91), Math.min(item[2], cell[2] * .92)],
          model, color: theme.palette[(seed % theme.palette.length + block + level) % theme.palette.length] ?? COLORS.white,
        });
      }
    }
  }
  return slots;
}

/** Model geometry is independent of the rack. A planogram anchors each reusable item family. */
export function buildMerchandise(slot: ShelfSlot): DetailPart[] {
  const [w,h,d] = slot.modelSize;
  const out: DetailPart[] = [];
  const paper = '#eee6cb';
  const cap = '#e2dfcd';
  const add = (name: string, at: Vec3, dims: Vec3, color: string, material: DetailMaterial = 'product', primitive: DetailPrimitive = 'box'): void => {
    const offset = fixtureAxes([at[0] * w, at[1] * h, at[2] * d * slot.side], slot.swapsAxes);
    out.push({ id: `${name}-${slot.id}`, primitive, material, color,
      position: [slot.anchor[0] + offset[0], slot.anchor[1] + offset[1], slot.anchor[2] + offset[2]],
      size: fixtureAxes([dims[0] * w, dims[1] * h, dims[2] * d], slot.swapsAxes) });
  };

  switch (slot.model) {
    case 'carton':
      add('pack-box', [0,.49,0], [.98,.98,.92], slot.color);
      add('pack-label', [0,.51,.468], [.66,.40,.016], paper, 'label');
      if (slot.level === 3) add('package-stripe', [0,.987,0], [.26,.014,.91], paper, 'label');
      break;
    case 'pouch':
      add('pack-pouch', [0,.43,0], [1,.86,.96], slot.color, 'product', 'sphere');
      add('pack-pouch-base', [0,.035,0], [.63,.07,.70], slot.color);
      add('pack-pouch-crimp', [0,.86,0], [.70,.21,.22], slot.color);
      break;
    case 'jar':
      add('pack-jar', [0,.45,0], [.92,.9,.96], slot.color, 'product', 'sphere');
      add('pack-jar-base', [0,.035,0], [.58,.07,.68], slot.color);
      add('jar-lid', [0,.905,0], [1,.19,1], cap);
      break;
    case 'bottle':
      add('pack-bottle', [0,.39,0], [1,.78,1], slot.color, 'product', 'sphere');
      add('pack-bottle-base', [0,.035,0], [.61,.07,.61], slot.color);
      add('bottle-neck', [0,.78,0], [.38,.28,.38], slot.color);
      add('bottle-cap', [0,.94,0], [.45,.12,.45], cap, 'label');
      break;
    case 'detergent':
      // The three handle beams leave an actual open aperture above the asymmetric bottle body.
      add('pack-bottle-detergent', [0,.33,0], [.99,.66,.93], slot.color);
      add('bottle-neck-detergent', [-.30,.76,0], [.28,.31,.40], slot.color);
      add('bottle-cap-detergent', [-.30,.94,0], [.34,.12,.47], cap, 'label');
      add('bottle-neck-handle-left', [-.04,.75,0], [.13,.23,.3], slot.color);
      add('bottle-neck-handle-right', [.395,.75,0], [.13,.23,.3], slot.color);
      add('bottle-neck-handle-top', [.18,.86,0], [.56,.095,.3], slot.color);
      add('pack-label', [-.02,.34,.473], [.67,.32,.016], paper, 'label');
      break;
    case 'tissue':
      add('pack-tissue', [0,.48,0], [1,.96,.97], slot.color);
      add('pack-label', [0,.972,0], [.84,.024,.77], paper, 'label');
      break;
    case 'sack':
      add('pack-sack', [0,.40,0], [1,.8,.98], slot.color, 'product', 'sphere');
      add('pack-sack-base', [0,.04,0], [.60,.08,.62], slot.color);
      break;
  }
  return out;
}

/** Aggregate distant adjacent facings into bounded stock blocks, never into rack
 * structure. Retains display color, approximate silhouette and both side rows.
 * Full-size product shapes and individual slot gaps are restored at near LOD.
 */
export function buildFarShelfMerchandise(slots: readonly ShelfSlot[]): DetailPart[] {
  const bays = slots.length / (LEVELS * 2);
  if (bays <= 8) return slots.flatMap(buildMerchandise);
  const blockSize = Math.ceil(bays / 8);
  const parts: DetailPart[] = [];
  for (let i=0;i<slots.length;i+=bays) {
    const row = slots.slice(i,i+bays);
    for (let j=0;j<row.length;j+=blockSize) {
      const block = row.slice(j,j+blockSize);
      const first = block[0];
      if (first === undefined) continue;
      const axis = first.swapsAxes ? 2 : 0;
      const left = Math.min(...block.map(p=>p.anchor[axis]-p.modelSize[0]*.49));
      const right = Math.max(...block.map(p=>p.anchor[axis]+p.modelSize[0]*.49));
      const height = Math.max(...block.map(p=>p.modelSize[1]))*.84;
      const depth = Math.max(...block.map(p=>p.modelSize[2]))*.91;
      const position: Vec3 = [...first.anchor];
      position[axis] = (left+right)/2;
      position[1] += height/2;
      parts.push({ id: `stock-block-${first.id}`, primitive:'box', material:'product', color:first.color,
        position, size:fixtureAxes([right-left,height,depth],first.swapsAxes) });
    }
  }
  return parts;
}
