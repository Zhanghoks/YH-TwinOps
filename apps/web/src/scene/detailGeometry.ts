import type { Fixture } from '@yh/contracts';

export type DetailPrimitive = 'box' | 'sphere';
export type DetailMaterial = 'metal' | 'wood' | 'glass' | 'product' | 'label' | 'rubber';
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

type MerchandisingStyle = 'mixed' | 'beverages' | 'household' | 'packaged' | 'bulk';
interface MerchandisingTheme { style: MerchandisingStyle; accent: string; panel: string; palette: string[] }
/** Zone colours are semantic, stable across fixture IDs; no real brand or SKU mapping. */
function merchandisingTheme(zoneId: string): MerchandisingTheme {
  switch (zoneId) {
    case 'zone-beverages': return { style: 'beverages', accent: '#496c77', panel: '#cad9d9', palette: ['#799c94', '#5d8191', '#bca36b', '#d0c6a8'] };
    case 'zone-household': return { style: 'household', accent: '#68738d', panel: '#d9dde5', palette: ['#94afbd', '#bbc8c0', '#8f9ab1', '#dddacb'] };
    case 'zone-packaged': return { style: 'packaged', accent: '#a16b4e', panel: '#ddc9b4', palette: ['#b76d4f', '#d1ad63', '#d8c7a3', '#8d9a71'] };
    case 'zone-bulk': return { style: 'bulk', accent: '#92734d', panel: '#b39a73', palette: ['#c4b18a', '#d7c6a4', '#a39470', '#d4b57c'] };
    default: return { style: 'mixed', accent: COLORS.trim, panel: '#d5dcd6', palette: PACKS };
  }
}

/**
 * Original generic merchandising, not measured stock, inventory, brand packaging or real SKU data.
 * Normalized construction keeps ALL detail inside StoreLayout's existing collision envelope.
 * Bounded bay counts cap instance count even for exceptionally large fixture dimensions.
 */
export type DetailFixtureShape = Pick<Fixture, 'fixtureId' | 'fixtureType' | 'zoneId' | 'widthM' | 'depthM' | 'heightM' | 'x' | 'y' | 'z' | 'rotationY'>;
export function buildFixtureDetail(f: DetailFixtureShape): DetailPart[] {
  if (![f.widthM, f.depthM, f.heightM].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Fixture dimensions must be finite and positive');
  }
  const parts: DetailPart[] = [];
  const hash = [...f.fixtureId].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  const colorAt = (colors: string[], i: number): string => colors[(hash + i) % colors.length] ?? COLORS.white;
  // x/z: [-.5,.5], y: [0,1]. Sizes are fractions of the declared envelope.
  const add = (id: string, position: [number, number, number], size: [number, number, number], color: string, material: DetailMaterial = 'metal', primitive: DetailPrimitive = 'box'): void => {
    parts.push({ id, primitive, position: [position[0] * f.widthM, position[1] * f.heightM, position[2] * f.depthM], size: [size[0] * f.widthM, size[1] * f.heightM, size[2] * f.depthM], color, material });
  };
  const theme = merchandisingTheme(f.zoneId);
  const bottleHeavy = theme.style === 'beverages' || theme.style === 'household';
  const bays = Math.min(bottleHeavy ? 6 : 8, Math.max(3, Math.round(f.widthM / 0.45)));
  const xAt = (i: number, count: number, span = 0.88): number => ((i + 0.5) / count - 0.5) * span;

  switch (f.fixtureType) {
    case 'GONDOLA': {
      add('plinth', [0, .045, 0], [.98, .09, .96], theme.accent, theme.style === 'bulk' ? 'wood' : 'metal');
      add('central-spine', [0, .52, 0], [.95, .92, .035], COLORS.white);
      for (const x of [-.47, .47]) add(`upright-${x}`, [x, .52, 0], [.025, .96, .055], COLORS.metal);
      // End panels / coloured bands identify department without covering top-down stock.
      for (const edge of [-1, 1]) {
        add(`end-panel-${edge}`, [edge * .485, .47, 0], [.02, .76, .66], theme.panel, theme.style === 'bulk' ? 'wood' : 'metal');
        add(`department-band-${edge}`, [edge * .497, .78, 0], [.006, .08, .66], theme.accent, 'label');
        for (let mark = 0; mark < 3; mark++) add(`department-mark-${edge}-${mark}`, [edge * .497, .57 - mark * .065, 0], [.006, .025, .28 - mark * .045], COLORS.white, 'label');
      }
      for (let level = 0; level < 4; level++) {
        const y = .13 + level * .205;
        add(`shelf-${level}`, [0, y, 0], [.96, .026, .93], COLORS.white);
        for (const side of [-1, 1]) {
          add(`price-rail-${level}-${side}`, [0, y + .015, side * .468], [.95, .035, .018], theme.accent);
          for (let col = 0; col < bays; col++) {
            const x = xAt(col, bays);
            const slot = col + level;
            const kind = theme.style === 'beverages' ? (slot % 5 === 4 ? 2 : 1)
              : theme.style === 'household' ? (slot % 4 === 3 ? 0 : 1)
              : theme.style === 'packaged' ? (slot % 4 === 3 ? 2 : 0)
              : theme.style === 'bulk' ? 3 : slot % 3;
            const height = theme.style === 'household' ? .15 + (slot % 3) * .01
              : theme.style === 'beverages' ? .13 + (slot % 3) * .01
              : .115 + (slot % 5) * .012;
            const bottom = y + .013;
            const id = `${level}-${side}-${col}`;
            const color = theme.palette[slot % theme.palette.length] ?? COLORS.white;
            if (kind === 1) {
              // Rounded bottle body with a narrow neck and closure, no new mesh primitive.
              add(`pack-bottle-${id}`, [x, bottom + height * .375, side * .24], [.54 / bays, height * .75, .22], color, 'product', 'sphere');
              add(`bottle-neck-${id}`, [x, bottom + height * .80, side * .24], [.20 / bays, height * .20, .08], color, 'product');
              add(`bottle-cap-${id}`, [x, bottom + height * .96, side * .24], [.24 / bays, height * .08, .10], COLORS.white, 'label');
            } else if (kind === 2) {
              add(`pack-jar-${id}`, [x, bottom + height * .44, side * .24], [.65 / bays, height * .88, .25], color, 'product', 'sphere');
              add(`jar-lid-${id}`, [x, bottom + height * .93, side * .24], [.52 / bays, height * .10, .20], COLORS.metal);
            } else if (kind === 3) {
              add(`pack-sack-${id}`, [x, bottom + height * .46, side * .24], [.70 / bays, height * .92, .30], color, 'product', 'sphere');
              add(`sack-seam-${id}`, [x, bottom + height * .94, side * .24], [.30 / bays, height * .04, .11], theme.accent, 'wood');
            } else {
              add(`pack-box-${id}`, [x, bottom + height / 2, side * .24], [.70 / bays, height, .31], color, 'product');
            }
            const face = kind === 1 ? .343 : kind === 2 ? .357 : kind === 3 ? .378 : .398;
            add(`pack-label-${id}`, [x, bottom + height * .43, side * face], [.36 / bays, height * .30, .008], COLORS.label, 'label');
            add(`price-${level}-${side}-${col}`, [x, y + .018, side * .479], [.38 / bays, .021, .006], COLORS.white, 'label');
          }
        }
      }
      // Only the narrow spine is capped: an overhead lid would hide the merchandise.
      add('top-cap', [0, .985, 0], [.98, .03, .065], COLORS.metal);
      break;
    }
    case 'PRODUCE_ISLAND': {
      add('base', [0, .31, 0], [.92, .62, .9], COLORS.wood, 'wood');
      add('toe-kick', [0, .04, 0], [.85, .08, .84], COLORS.dark);
      add('display-bed', [0, .66, 0], [.98, .08, .98], COLORS.wood, 'wood');
      for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
        const x = xAt(col, 3, .9), z = row === 0 ? -.235 : .235;
        const id = `crate-${row}-${col}`;
        add(`${id}-floor`, [x, .72, z], [.28, .06, .43], COLORS.dark);
        for (const edge of [-1, 1]) {
          add(`${id}-side-${edge}`, [x + edge * .14, .8, z], [.014, .16, .43], COLORS.wood, 'wood');
          add(`${id}-end-${edge}`, [x, .8, z + edge * .215], [.28, .16, .014], COLORS.wood, 'wood');
        }
        for (let n = 0; n < 6; n++) {
          add(`${id}-fruit-${n}`, [x + (n % 3 - 1) * .076 + ((n + col) % 2) * .006, .81 + (n % 2) * .02, z + (Math.floor(n / 3) - .5) * .18 + ((n + row) % 3 - 1) * .009], [.059 + (n % 3) * .004, .11 + (n % 2) * .015, .12 + (n % 3) * .01], colorAt(FRUIT, row * 3 + col), 'product', 'sphere');
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
      for (let door = 0; door < doors; door++) {
        const x = xAt(door, doors, .95);
        add(`glass-door-${door}`, [x, .525, .455], [.91 / doors, .73, .018], COLORS.glass, 'glass');
        add(`door-frame-${door}`, [x - .455 / doors, .525, .47], [.012, .75, .026], COLORS.metal);
        add(`handle-${door}`, [x + .33 / doors, .54, .485], [.016, .23, .025], COLORS.dark);
      }
      break;
    }
    case 'CHECKOUT': {
      add('counter-base', [0, .33, 0], [.96, .66, .82], COLORS.white);
      add('toe-kick', [0, .04, 0], [.9, .08, .75], COLORS.dark);
      add('counter-edge', [0, .67, 0], [1, .045, .98], COLORS.metal);
      add('belt', [-.18, .699, 0], [.55, .013, .72], COLORS.belt, 'rubber');
      for (const z of [-.39, .39]) add(`belt-rail-${z}`, [-.18, .72, z], [.56, .055, .025], COLORS.metal);
      add('scanner', [.16, .704, 0], [.1, .018, .35], '#263e45', 'glass');
      add('bagging-tray', [.34, .70, .06], [.22, .02, .7], COLORS.dark);
      add('pos-stem', [.1, .79, -.31], [.03, .18, .04], COLORS.dark);
      add('pos-screen-frame', [.1, .91, -.31], [.17, .18, .06], COLORS.dark);
      add('pos-screen', [.1, .91, -.274], [.14, .14, .009], '#6eada7', 'glass');
      add('card-reader', [.24, .76, .32], [.08, .09, .1], COLORS.dark);
      add('belt-item-a', [-.3, .77, -.11], [.1, .13, .22], colorAt(PACKS, 1), 'product');
      add('belt-item-b', [-.14, .75, .13], [.08, .09, .16], colorAt(PACKS, 2), 'product');
      break;
    }
    case 'DELI_COUNTER': {
      add('case-base', [0, .27, 0], [.98, .54, .97], COLORS.wood, 'wood');
      add('toe-kick', [0, .04, 0], [.92, .08, .9], COLORS.dark);
      add('steel-bed', [0, .57, 0], [.99, .06, .96], COLORS.metal);
      for (let col = 0; col < 4; col++) {
        const x = xAt(col, 4, .9);
        add(`tray-${col}`, [x, .62, 0], [.20, .045, .65], COLORS.dark);
        add(`tray-food-${col}`, [x, .665, 0], [.17, .045, .55], colorAt(FRUIT, col), 'product');
        add(`tray-price-${col}`, [x, .67, .37], [.11, .07, .012], COLORS.label, 'label');
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
