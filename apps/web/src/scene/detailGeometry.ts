import { buildFarShelfMerchandise, buildMerchandise, buildShelfPlanogram, buildShelfStructure, merchandisingTheme, supportsShelfPlanogram } from './shelfDisplay';
export { buildMerchandise, buildShelfPlanogram, buildShelfStructure, supportsShelfPlanogram } from './shelfDisplay';
import { buildSpecialComponent, type SpecialComponent } from './specialComponents';
import type { Fixture } from '@yh/contracts';

export type DetailPrimitive = 'box' | 'sphere';
export type DetailMaterial = 'metal' | 'wood' | 'glass' | 'product' | 'label' | 'rubber' | 'produceBed';
/** Unit boxes / diameter-1 spheres scaled by full size. Bottom-centred, Y-up local coordinates. */
export interface DetailPart {
  id: string;
  primitive: DetailPrimitive;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  material: DetailMaterial;
}

const COLORS = {
  metal: '#c4cbd0', dark: '#374549', belt: '#273132', wood: '#a8845f',
  glass: '#b9dce1', label: '#f4edcf', white: '#e9e9e2', trim: '#58756a',
};
const PACKS = ['#b75e48', '#d9ae58', '#729b8c', '#e1d3ac', '#698ba1', '#bc927c'];
// Muted vegetable / apple / citrus shades, avoiding toy-like primary colours.
const FRUIT = ['#82934c', '#c9943e', '#ac5943', '#587d49', '#bfad67', '#843f37'];

/**
 * Original generic merchandising, not measured stock, inventory, brand packaging or real SKU data.
 * Normalized construction keeps ALL detail inside StoreLayout's existing collision envelope.
 * Bounded bay counts cap instance count even for exceptionally large fixture dimensions.
 */
export type DetailFixtureShape = Pick<Fixture, 'fixtureId' | 'fixtureType' | 'zoneId' | 'widthM' | 'depthM' | 'heightM' | 'x' | 'y' | 'z' | 'rotationY'> & { designVariant?: 'vegetable' | SpecialComponent };
export function buildFixtureDetail(f: DetailFixtureShape, { stocked = true, lod = 'near' }: { stocked?: boolean; lod?: 'near' | 'far' } = {}): DetailPart[] {
  if (![f.widthM, f.depthM, f.heightM].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Fixture dimensions must be finite and positive');
  }
  if (f.designVariant && f.designVariant !== 'vegetable') return buildSpecialComponent(f, f.designVariant);
  if (supportsShelfPlanogram(f)) {
    const structure = buildShelfStructure(f);
    if (!stocked) return structure;
    const slots = buildShelfPlanogram(f);
    return [...structure, ...(lod === 'far' ? buildFarShelfMerchandise(slots) : slots.flatMap(buildMerchandise))];
  }
  const parts: DetailPart[] = [];
  const hash = [...f.fixtureId].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  const colorAt = (colors: string[], i: number): string => colors[(hash + i) % colors.length] ?? COLORS.white;
  // x/z: [-.5,.5], y: [0,1]. Sizes are fractions of the declared envelope.
  const add = (id: string, position: [number, number, number], size: [number, number, number], color: string, material: DetailMaterial = 'metal', primitive: DetailPrimitive = 'box'): void => {
    parts.push({ id, primitive, position: [position[0] * f.widthM, position[1] * f.heightM, position[2] * f.depthM], size: [size[0] * f.widthM, size[1] * f.heightM, size[2] * f.depthM], color, material });
  };
  const theme = merchandisingTheme(f.zoneId);
  const xAt = (i: number, count: number, span = 0.88): number => ((i + 0.5) / count - 0.5) * span;

  if (f.designVariant === 'vegetable') {
    add('vegetable-plinth', [0,.13,0], [.98,.26,.98], COLORS.wood,'wood');
    for (const x of [-.475,.475]) add(`vegetable-upright-${x}`, [x,.61,-.43], [.025,.76,.035], COLORS.dark);
    for (let level=0;level<3;level++) {
      const y=.3+level*.26, z=.32-level*.3;
      add(`vegetable-tray-${level}`, [0,y,z], [.96,.045,.31], COLORS.wood,'wood');
      for(const x of [-.46,.46]) add(`vegetable-bracket-${level}-${x}`, [x,y-.025,(z-.43)/2], [.022,.035,z+.43+.03], COLORS.dark);
      add(`vegetable-back-${level}`, [0,y+.075,-.44],[.92,.14,.02],'#567344');
      add(`vegetable-retainer-${level}`, [0,y+.04,z+.151], [.96,.065,.018], COLORS.dark);
      add(`vegetable-price-${level}`, [0,y+.055,z+.163], [.76,.025,.005], COLORS.label,'label');
      for(let col=0;col<4;col++) {
        const x=xAt(col,4,.91);
        add(`vegetable-bed-${level}-${col}`, [x,y+.045,z], [.215,.045,.26], colorAt(FRUIT,col+level),'produceBed');
        for(let n=0;n<6;n++) {
          const px=x+(n%3-1)*.06, pz=z+(Math.floor(n/3)-.5)*.12;
          add(`vegetable-piece-${level}-${col}-${n}`, [px,y+.09,pz], [.05,.065,.09], colorAt(FRUIT,col+level),'product','sphere');
          if ((col+level)%3===0) for(let leaf=0;leaf<2;leaf++) add(`vegetable-leaf-${level}-${col}-${n}-${leaf}`, [px+(leaf-.5)*.025,y+.12,pz], [.045,.018,.095], leaf ? '#729a51' : '#53763e','product','sphere');
        }
      }
    }
    add('vegetable-header',[0,.96,-.43],[.96,.08,.04],COLORS.trim);
    return parts;
  }

  switch (f.fixtureType) {
    case 'PRODUCE_ISLAND': {
      add('base', [0, .31, 0], [.92, .62, .9], COLORS.wood, 'wood');
      add('toe-kick', [0, .04, 0], [.85, .08, .84], COLORS.dark);
      // Board 01: warm framed joinery, inset panels and a recessed metal plinth.
      for (const side of [-1, 1]) {
        for (const y of [.12, .58]) add(`base-border-${side}-${y}`, [0, y, side*.456], [.94, .035, .014], COLORS.dark);
        for (let i = 0; i < 4; i++) add(`base-stile-${side}-${i}`, [(i/3-.5)*.9, .35, side*.456], [.012, .47, .014], COLORS.dark);
      }
      add('display-bed', [0, .66, 0], [.98, .08, .98], COLORS.wood, 'wood');
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
        const x = xAt(col, 3, .9), z = row === 0 ? -.235 : .235;
        const id = `crate-${row}-${col}`;
        add(`${id}-floor`, [x, .72, z], [.28, .06, .43], COLORS.dark);
        for (const edge of [-1, 1]) {
          add(`${id}-side-${edge}`, [x + edge * .14, .8, z], [.014, .16, .43], COLORS.wood, 'wood');
          add(`${id}-end-${edge}`, [x, .8, z + edge * .215], [.28, .16, .014], COLORS.wood, 'wood');
        }
        // A low merchandise bed avoids empty black crates. Surface fruit is illustrative,
        // physically capped instead of growing to 40cm apples on wide inferred islands.
        add(`${id}-produce-bed`, [x, .78, z], [.26, .045, .4], colorAt(FRUIT, row * 3 + col), 'produceBed');
        for (let n = 0; n < 24; n++) {
          const variety = (row * 3 + col) % 3;
          const scale = .78 + (n % 4) * .065;
          add(`${id}-fruit-${n}`, [x + (n % 6 - 2.5) * .043, .815 + (n % 2) * .012, z + (Math.floor(n / 6) - 1.5) * .095],
            [Math.min(.035, (variety === 1 ? .13 : .18) / f.widthM) * scale,
              Math.min(.09, (variety === 2 ? .10 : .15) / f.heightM) * scale,
              Math.min(.075, .18 / f.depthM) * scale],
            colorAt(FRUIT, row * 3 + col + (n % 7 === 0 ? 1 : 0)), 'product', 'sphere');
        }
        for (const edge of [-1, 1]) for (let slat = 0; slat < 2; slat++) {
          add(`${id}-slat-${edge}-${slat}`, [x, .74 + slat*.06, z + edge*.224], [.28, .018, .012], '#a47c50', 'wood');
        }
        add(`${id}-price`, [x, .83, z + .225], [.12, .07, .008], COLORS.label, 'label');
      }
      break;
    }
    case 'FREEZER': {
      const doors = Math.min(5, Math.max(2, Math.round(f.widthM / .85)));
      add('cabinet-back', [0, .5, -.44], [.99, 1, .12], COLORS.white);
      add('base-grille', [0, .075, 0], [1, .15, 1], COLORS.dark);
      // Cutaway roof keeps chilled stock visible from the operational overview.
      add('header', [0, .95, .455], [1, .1, .08], COLORS.white);
      for (const x of [-.485, .485]) add(`side-${x}`, [x, .5, 0], [.03, .85, .98], COLORS.metal);
      for (let level = 0; level < 3; level++) {
        const y = .22 + level * .22;
        add(`chilled-shelf-${level}`, [0, y, 0], [.95, .025, .8], COLORS.white);
        for (let col = 0; col < doors * 2; col++) {
          if (theme.style === 'beverages') {
            const x = xAt(col, doors * 2);
            const color = theme.palette[col % theme.palette.length] ?? COLORS.white;
            add(`chilled-bottle-${level}-${col}`, [x, y + .074, .08], [.58 / (doors * 2), .12, .26], color, 'product', 'sphere');
            add(`chilled-neck-${level}-${col}`, [x, y + .143, .08], [.22 / (doors * 2), .04, .09], color, 'product');
            add(`chilled-cap-${level}-${col}`, [x, y + .168, .08], [.25 / (doors * 2), .01, .11], COLORS.white, 'label');
          } else {
            add(`chilled-pack-${level}-${col}`, [xAt(col, doors * 2), y + .08, .08], [.65 / (doors * 2), .13, .4], colorAt(PACKS, col + level), 'product');
          }
        }
      }
      // Board 07 is an open dairy multideck; board 08 retains framed glass doors.
      for (let i = 0; i < 10; i++) add(`vent-slot-${i}`, [xAt(i, 10), .075, .497], [.055, .055, .006], '#78817e');
      if (f.zoneId === 'zone-dairy') {
        for (let level = 0; level < 3; level++) {
          add(`chilled-price-${level}`, [0, .245 + level*.22, .405], [.94, .035, .012], COLORS.label, 'label');
        }
        for (const x of [-.455, .455]) add(`dairy-light-${x}`, [x, .54, .385], [.014, .72, .018], '#fff5d8', 'label');
      }
      for (let door = 0; door < (f.zoneId === 'zone-dairy' ? 0 : doors); door++) {
        const x = xAt(door, doors, .95);
        add(`glass-door-${door}`, [x, .525, .455], [.91 / doors, .73, .018], COLORS.glass, 'glass');
        add(`door-frame-${door}`, [x - .455 / doors, .525, .47], [.012, .75, .026], COLORS.metal);
        add(`handle-${door}`, [x + .33 / doors, .54, .485], [.016, .23, .025], COLORS.dark);
      }
      break;
    }
    case 'CHECKOUT': {
      // Construct along the footprint's long axis, without rotating the business fixture.
      // Wide counters retain their original local geometry and every semantic part ID.
      const longitudinal = f.depthM > f.widthM;
      const screenSpan = longitudinal ? Math.min(.17, .42 / f.depthM) : .17;
      const checkoutAdd: typeof add = (id, position, size, color, material, primitive) => {
        if (longitudinal) {
          add(id, [position[2], position[1], position[0]], [size[2], size[1], size[0]], color, material, primitive);
        } else add(id, position, size, color, material, primitive);
      };
      checkoutAdd('counter-base', [0, .33, 0], [.96, .66, .82], COLORS.white);
      checkoutAdd('toe-kick', [0, .04, 0], [.9, .08, .75], COLORS.dark);
      checkoutAdd('counter-edge', [0, .67, 0], [1, .045, .98], COLORS.metal);
      checkoutAdd('belt', [-.18, .699, 0], [.55, .013, .72], COLORS.belt, 'rubber');
      for (const z of [-.39, .39]) checkoutAdd(`belt-rail-${z}`, [-.18, .72, z], [.56, .055, .025], COLORS.metal);
      checkoutAdd('scanner', [.16, .704, 0], [.1, .018, .35], '#263e45', 'glass');
      checkoutAdd('bagging-tray', [.34, .70, .06], [.22, .02, .7], COLORS.dark);
      checkoutAdd('pos-stem', [.1, .79, -.31], [.03, .18, .04], COLORS.dark);
      checkoutAdd('pos-screen-frame', [.1, .91, -.31], [screenSpan, .18, .06], COLORS.dark);
      checkoutAdd('pos-screen', [.1, .91, -.274], [longitudinal ? screenSpan * 14 / 17 : .14, .14, .009], '#6eada7', 'label');
      checkoutAdd('card-reader', [.24, .76, .32], [.08, .09, .1], COLORS.dark);
      checkoutAdd('belt-item-a', [-.3, .77, -.11], [.1, .13, .22], colorAt(PACKS, 1), 'product');
      checkoutAdd('belt-item-b', [-.14, .75, .13], [.08, .09, .16], colorAt(PACKS, 2), 'product');
      // Separate checkout work surfaces, generic UI and paper handling; no real sales data.
      checkoutAdd('scanner-inset', [.16,.716,0], [.075,.006,.28], '#789e9d','label');
      checkoutAdd('reader-display', [.24,.809,.32], [.055,.008,.065], '#8ac3b6','label');
      checkoutAdd('receipt-printer', [.30,.765,-.29], [.10,.12,.14], '#d5dad3');
      checkoutAdd('receipt-slot', [.30,.828,-.245], [.075,.008,.02], COLORS.dark,'rubber');
      checkoutAdd('receipt-paper', [.30,.85,-.24], [.065,.04,.008], COLORS.label,'label');
      checkoutAdd('pos-ui-header', [.1,.953,-.267], [screenSpan*.72,.014,.003], '#d4ece4','label');
      for(let line=0;line<2;line++) checkoutAdd(`pos-ui-line-${line}`, [.1,.91-line*.025,-.267], [screenSpan*(line===0?.60:.42),.009,.003], '#b9d8cd','label');
      checkoutAdd('bag-base', [.35,.77,.12], [.14,.12,.22], '#b99a68','wood');
      for(const side of [-1,1]) {
        checkoutAdd(`bag-handle-post-${side}`, [.35+side*.045,.862,.12], [.012,.065,.016], '#8f744d','wood');
      }
      checkoutAdd('bag-handle-top', [.35,.895,.12], [.10,.012,.016], '#8f744d','wood');

      break;
    }
    case 'DELI_COUNTER': {
      const stainless = f.zoneId === 'zone-seafood' || f.zoneId === 'zone-meat';
      add('case-base', [0, .27, 0], [.98, .54, .97], stainless ? '#b9bdb7' : COLORS.wood, stainless ? 'metal' : 'wood');
      for (let panel = 0; panel < 4; panel++) {
        add(`counter-front-panel-${panel}`, [xAt(panel, 4, .94), .30, .489], [.22, .36, .012], stainless ? '#d6d8d1' : '#bd9567', stainless ? 'metal' : 'wood');
      }
      add('toe-kick', [0, .04, 0], [.92, .08, .9], COLORS.dark);
      add('steel-bed', [0, .57, 0], [.99, .06, .96], COLORS.metal);
      for (let col = 0; col < 4; col++) {
        const x = xAt(col, 4, .9);
        add(`tray-${col}`, [x, .62, 0], [.20, .045, .65], COLORS.dark);
        const seafood = f.zoneId === 'zone-seafood', meat = f.zoneId === 'zone-meat';
        const bakery = f.zoneId === 'zone-bakery';
        // Generic illustrative food only: not SKUs or measured stock. Keep small items
        // physically capped even when the inferred reference counter is unusually wide.
        const bed = seafood ? '#dcebea' : meat ? '#eee0d8' : bakery ? '#ba8b53' : '#d7c090';
        const food = seafood ? '#78999f' : meat ? '#bc6967' : bakery ? '#d5a65e' : '#a77b42';
        add(`tray-food-${col}`, [x, .665, 0], [.17, .045, .55], bed, 'product');
        for (let item = 0; item < 6; item++) {
          const px = x + (item % 3 - 1) * .05;
          const pz = (Math.floor(item / 3) - .5) * .25;
          const sx = Math.min(.038, .45 / f.widthM), sz = Math.min(.19, .65 / f.depthM);
          const sy = Math.min(.055, .10 / f.heightM);
          add(`fresh-item-${col}-${item}`, [px, .69 + sy/2, pz], [sx, sy, sz], food, 'product', 'sphere');
          if (seafood) add(`fish-tail-${col}-${item}`, [px, .70, pz + sz*.46], [sx*.8, sy*.3, sz*.23], '#96b3b6', 'product');
          if (bakery) for (let score = 0; score < 2; score++) {
            add(`bread-score-${col}-${item}-${score}`, [px, .69+sy, pz+(score-.5)*sz*.35], [sx*.55, sy*.10, sz*.07], '#f0d4a2', 'product');
          }
        }
        add(`tray-price-${col}`, [x, .67, .37], [.11, .07, .012], COLORS.label, 'label');
      }
      if (f.zoneId === 'zone-bakery') {
        add('bakery-upper-shelf', [0,.84,-.05], [.92,.022,.55], COLORS.metal);
        for(const x of [-.45,.45]) add(`bakery-shelf-post-${x}`, [x,.74,-.27], [.018,.32,.018], COLORS.dark);
        for(let col=0;col<8;col++) {
          const x=xAt(col,8);
          add(`bakery-upper-bread-${col}`, [x,.89,-.05], [Math.min(.09,.25/f.widthM),.065,.22], '#d5a65e','product','sphere');
          add(`bakery-upper-score-${col}`, [x,.924,-.05], [Math.min(.05,.14/f.widthM),.006,.025], '#f0d4a2','product');
        }
        add('bakery-upper-price', [0,.85,.24],[.88,.03,.012],COLORS.label,'label');
      }
      add('front-glass', [0, .80, .46], [.95, .37, .018], COLORS.glass, 'glass');
      add('top-glass', [0, .985, .07], [.97, .018, .8], COLORS.glass, 'glass');
      for (const x of [-.48, .48]) add(`glass-end-${x}`, [x, .80, .07], [.018, .38, .8], COLORS.glass, 'glass');
      add('front-rail', [0, .98, .46], [.99, .025, .035], COLORS.metal);
      break;
    }
    case 'DOOR': {
      for (const x of [-.47, .47]) add(`frame-${x}`, [x, .5, 0], [.06, 1, .8], COLORS.metal);
      add('frame-top', [0, .97, 0], [.94, .06, .8], COLORS.dark);
      for (const x of [-.23, .23]) {
        add(`door-panel-${x}`, [x, .47, 0], [.44, .92, .08], COLORS.glass, 'glass');
        add(`door-bar-${x}`, [x, .48, .06], [.25, .035, .04], COLORS.metal);
      }
      add('safety-stripe', [0, .55, .048], [.88, .04, .008], COLORS.trim, 'label');
      break;
    }
    default: {
      add('service-base', [0, .43, 0], [.96, .86, .94], COLORS.wood, 'wood');
      add('service-top', [0, .91, 0], [1, .1, 1], COLORS.white);
      add('toe-kick', [0, .035, 0], [.91, .07, .9], COLORS.dark);
      for (const x of [-.23, .23]) {
        add(`cabinet-front-${x}`, [x, .46, .476], [.44, .7, .012], COLORS.wood, 'wood');
        add(`cabinet-handle-${x}`, [x, .64, .49], [.12, .022, .02], COLORS.metal);
      }
    }
  }
  return parts;
}
