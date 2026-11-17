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
const FRUIT = ['#b6bf54', '#df9b3f', '#c66d47', '#779b55', '#d6bf67', '#9e5247'];

/**
 * Original generic merchandising, not measured stock, inventory, brand packaging or real SKU data.
 * Normalized construction keeps ALL detail inside StoreLayout's existing collision envelope.
 * Bounded bay counts cap instance count even for exceptionally large fixture dimensions.
 */
export function buildFixtureDetail(f: Fixture): DetailPart[] {
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
  const bays = Math.min(8, Math.max(3, Math.round(f.widthM / 0.45)));
  const xAt = (i: number, count: number, span = 0.88): number => ((i + 0.5) / count - 0.5) * span;

  switch (f.fixtureType) {
    case 'GONDOLA': {
      add('plinth', [0, .045, 0], [.98, .09, .96], COLORS.dark);
      add('central-spine', [0, .52, 0], [.95, .92, .035], COLORS.white);
      for (const x of [-.47, .47]) add(`upright-${x}`, [x, .52, 0], [.025, .96, .91], COLORS.metal);
      for (let level = 0; level < 4; level++) {
        const y = .13 + level * .205;
        add(`shelf-${level}`, [0, y, 0], [.96, .026, .93], COLORS.white);
        for (const side of [-1, 1]) {
          add(`price-rail-${level}-${side}`, [0, y + .015, side * .468], [.95, .035, .018], COLORS.trim);
          for (let col = 0; col < bays; col++) {
            const x = xAt(col, bays);
            const height = .12 + ((col + level) % 3) * .015;
            add(`pack-${level}-${side}-${col}`, [x, y + .013 + height / 2, side * .24], [.70 / bays, height, .35], colorAt(PACKS, col + level), 'product');
            add(`pack-label-${level}-${side}-${col}`, [x, y + .07, side * .418], [.42 / bays, .045, .008], COLORS.label, 'label');
            add(`price-${level}-${side}-${col}`, [x, y + .018, side * .479], [.38 / bays, .021, .006], COLORS.white, 'label');
          }
        }
      }
      add('top-cap', [0, .985, 0], [.98, .03, .97], COLORS.trim);
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
          add(`${id}-fruit-${n}`, [x + (n % 3 - 1) * .076, .815 + (n % 2) * .025, z + (Math.floor(n / 3) - .5) * .19], [.067, .13, .14], colorAt(FRUIT, row * 3 + col), 'product', 'sphere');
        }
        add(`${id}-price`, [x, .83, z + .225], [.12, .07, .008], COLORS.label, 'label');
      }
      break;
    }
    case 'FREEZER': {
      const doors = Math.min(5, Math.max(2, Math.round(f.widthM / .85)));
      add('cabinet-back', [0, .5, -.44], [.99, 1, .12], COLORS.dark);
      add('base-grille', [0, .075, 0], [1, .15, 1], COLORS.dark);
      add('header', [0, .95, 0], [1, .1, 1], COLORS.trim);
      for (const x of [-.485, .485]) add(`side-${x}`, [x, .5, 0], [.03, .85, .98], COLORS.metal);
      for (let level = 0; level < 3; level++) {
        const y = .22 + level * .22;
        add(`chilled-shelf-${level}`, [0, y, 0], [.95, .025, .8], COLORS.white);
        for (let col = 0; col < doors * 2; col++) {
          add(`chilled-pack-${level}-${col}`, [xAt(col, doors * 2), y + .08, .08], [.65 / (doors * 2), .13, .4], colorAt(PACKS, col + level), 'product');
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
