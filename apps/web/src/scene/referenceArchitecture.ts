import type { Fixture } from '@yh/contracts';
import { obbsOverlap, type OBB } from '@storewright/overlap-audit';
import type { ArchitecturePart } from './storeArchitecture';

export const REFERENCE_SERVICE_LABELS = [
  { id: 'receiving', text: '后仓 / 收货', position: [-20, 3, -44] as const },
  { id: 'processing', text: '加工间', position: [27, 2, -41] as const },
  { id: 'chilled', text: '冷库 · 冷藏', position: [46, 2, -41] as const },
  { id: 'frozen', text: '冷库 · 冷冻', position: [57, 2, -41] as const },
  { id: 'service', text: '客服', position: [-25, 2, 38] as const },
  { id: 'entry', text: '入口', position: [-22, 1, 48] as const },
];

/** Original decorative approximation for the 130×100 reference candidate only.
 * Never an approved construction plan, fixture record, capacity or actual truck/cart inventory.
 * Whole decorative clusters are omitted on fixture conflicts; IDs/positions of fixtures are untouched.
 */
export function buildReferenceArchitecture(fixtures: readonly Fixture[] = []): ArchitecturePart[] {
  const clusters: ArchitecturePart[][] = [];
  let parts: ArchitecturePart[] = [];
  const group = (): void => { parts = []; clusters.push(parts); };
  const add = (id: string, position: ArchitecturePart['position'], size: ArchitecturePart['size'], color: string, extra: Partial<Pick<ArchitecturePart, 'emissive' | 'transparent' | 'primitive'>> = {}): void => {
    parts.push({ id: `reference-${id}`, primitive: 'box', position, size, color, ...extra });
  };
  const steel = '#bac2c1', dark = '#454c4c', white = '#ecebe5', crate = '#bd9453';
  // Four loading vehicles face the internal receiving apron, with no claimed arrivals or schedules.
  for (let i = 0; i < 4; i++) {
    group();
    const x = -59 + i * 7;
    add(`truck-${i}-chassis`, [x, .66, -43], [3.25, .36, 11], dark);
    add(`truck-${i}-cargo`, [x, 2.1, -44.2], [3.5, 2.8, 8.4], white);
    add(`truck-${i}-cab`, [x, 1.6, -38.3], [3.2, 1.9, 2.7], '#d4d9d6');
    add(`truck-${i}-windscreen`, [x, 1.9, -36.92], [2.65, .85, .035], '#42646d', { transparent: true });
    add(`truck-${i}-grille`, [x, 1.05, -36.91], [1.8, .3, .045], dark);
    for (const side of [-1, 1]) for (const z of [-46.2, -39]) {
      add(`truck-${i}-wheel-${side}-${z}`, [x + side * 1.58, .5, z], [.42, 1, 1], '#303638', { primitive: 'sphere' });
    }
    add(`truck-${i}-dock-line`, [x, .025, -34.5], [4.3, .025, .08], '#d6ba54');
  }
  // Two transverse carton rows surround, but never overlap, retained backroom footprints.
  // Decorative cartons are not warehouse inventory or capacity measurements.
  for (let col = 0; col < 7; col++) for (let row = 0; row < 2; row++) {
    group();
    const x = -28 + col * 6.3, z = row === 0 ? -47.3 : -34.4;
    const id = `warehouse-rack-${col}-${row}`;
    for (const edge of [-1, 1]) add(`${id}-upright-${edge}`, [x + edge * 2.5, 1.2, z], [.12, 2.4, 2.2], '#586b68');
    for (let level = 0; level < 2; level++) {
      add(`${id}-shelf-${level}`, [x, .25 + level * 1.15, z], [5.2, .12, 2.2], '#c69a56');
      for (let c = 0; c < 3; c++) add(`${id}-carton-${level}-${c}`, [x + (c - 1) * 1.55, .72 + level * 1.15, z], [1.3, .8, 1.65], c % 2 ? '#dcc085' : crate);
    }
  }
  // Low cutaway partitions, with front portal gaps and no roof over operational views.
  group();
  add('processing-partition-west', [15.8, .65, -41], [.28, 1.3, 17.6], '#d1d6d1');
  add('processing-partition-east', [39.5, .65, -41], [.28, 1.3, 17.6], '#d1d6d1');
  add('processing-partition-front-a', [21, .65, -32.25], [10.1, 1.3, .3], '#d1d6d1');
  add('processing-partition-front-b', [34.8, .65, -32.25], [9.1, 1.3, .3], '#d1d6d1');
  for (let i = 0; i < 4; i++) {
    group();
    const x = i % 2 ? 33 : 22, z = i < 2 ? -45.5 : -37.4;
    add(`processing-table-${i}-base`, [x, .5, z], [4.2, 1, 2], steel);
    add(`processing-table-${i}-top`, [x, 1.05, z], [4.5, .12, 2.25], '#e1e6e1');
    add(`processing-table-${i}-tray`, [x - .7, 1.14, z], [1.6, .06, 1.4], '#819b98');
    add(`processing-table-${i}-sink`, [x + 1.1, 1.14, z], [.9, .06, 1.1], '#687f81');
  }
  for (const [index, name] of ['chilled', 'frozen'].entries()) {
    group();
    const x = 46 + index * 11;
    const id = `coldroom-${name}`;
    for (const side of [-1, 1]) add(`${id}-partition-${side}`, [x + side * 4.9, .7, -41], [.25, 1.4, 17.4], '#dce4e2');
    add(`${id}-partition-back`, [x, .7, -49.55], [10, 1.4, .25], '#dce4e2');
    add(`${id}-partition-front-a`, [x - 3.3, .7, -32.4], [3.2, 1.4, .25], '#dce4e2');
    add(`${id}-partition-front-b`, [x + 3.3, .7, -32.4], [3.2, 1.4, .25], '#dce4e2');
    add(`${id}-door`, [x, 1.1, -32.4], [3.05, 2.2, .12], index ? '#8da9b8' : '#afcbc8', { transparent: true });
    add(`${id}-handle`, [x + 1.1, 1.05, -32.28], [.08, .55, .08], dark);
    for (let row = 0; row < 2; row++) {
      add(`${id}-rack-${row}`, [x, .45, -46 + row * 6], [6.8, .9, 2.2], '#a5b9b8');
      add(`${id}-crate-${row}`, [x, 1.15, -46 + row * 6], [6.2, .5, 1.8], '#cad8d4');
    }
  }
  // Reference service counter sits behind the entrance; z[43,50] remains an open approach.
  group();
  add('service-desk-base', [-25, .55, 37], [14, 1.1, 1.6], '#dfd9c6');
  add('service-desk-top', [-25, 1.15, 37], [14, .1, 1.8], '#50766a');
  for (const [side, x] of [-31.2, -18.8].entries()) {
    add(`service-desk-return-${side}`, [x, .55, 39.4], [1.6, 1.1, 3.4], '#dfd9c6');
    add(`service-desk-return-top-${side}`, [x, 1.15, 39.4], [1.8, .1, 3.6], '#50766a');
  }
  for (let i = 0; i < 2; i++) {
    add(`service-desk-screen-${i}`, [-29 + i * 8, 1.5, 37], [.7, .55, .12], '#344e50');
    add(`service-desk-screen-base-${i}`, [-29 + i * 8, 1.3, 37], [.15, .2, .15], dark);
  }
  for (let row = 0; row < 6; row++) {
    group();
    const x = -59.5 + row * 2.2;
    for (const side of [-1, 1]) add(`cart-bay-${row}-rail-${side}`, [x + side * .85, .65, 43.5], [.08, .08, 6], steel);
    for (let cart = 0; cart < 10; cart++) {
      const z = 41.3 + cart * .5;
      const id = `cart-bay-${row}-cart-${cart}`;
      add(`${id}-basket`, [x, .8, z], [1.2, .65, 1.45], '#b7c0bb', { transparent: true });
      add(`${id}-basket-rim`, [x, 1.14, z], [1.25, .07, 1.5], steel);
      add(`${id}-handle`, [x, 1.05, z + .84], [1.1, .08, .08], '#4c746a');
      for (const side of [-1, 1]) add(`${id}-wheel-${side}`, [x + side * .42, .16, z], [.2, .32, .32], dark, { primitive: 'sphere' });
    }
  }
  // Retracted glass door side panels leave a 13m central opening. No automatic-door simulation.
  // Only shallow floor inlays continue across the opening, with no raised threshold.
  for (const [index, x] of [-31.3, -13.7].entries()) {
    group();
    add(`entry-glass-${index}`, [x, 1.25, 49.5], [4.2, 2.5, .12], '#c0ded9', { transparent: true });
    for (const edge of [-1, 1]) add(`entry-jamb-${index}-${edge}`, [x + edge * 2.12, 1.3, 49.5], [.08, 2.6, .18], steel);
    add(`entry-lintel-${index}`, [x, 2.58, 49.5], [4.32, .08, .18], steel);
  }
  group();
  for (let i = 0; i < 3; i++) add(`entry-paving-${i}`, [-22.5, .006, 46 + i * 1.4], [12.6, .012, .06], '#b9b5a6');
  // Small planted edge pockets frame, rather than narrow, the central entrance approach.
  for (const [index, x] of [-35.5, -10.8].entries()) {
    group();
    add(`entry-planter-${index}-base`, [x, .35, 47.5], [1.2, .7, 2.3], '#d3cdb9');
    add(`entry-planter-${index}-green`, [x, .85, 47.5], [1.1, .7, 2.1], '#57764b', { primitive: 'sphere' });
  }
  // Static reference sign supports, not queue state or business identifier reassignment.
  // The UI supplies 01–24 text; no external fonts, logos or additional draw-call groups.
  const checkoutZones = new Set(['zone-checkout_n', 'zone-checkout_e', 'zone-checkout_s']);
  const lanes = fixtures.filter((f) => checkoutZones.has(f.zoneId)).slice().sort((a,b) => a.x-b.x);
  lanes.forEach((f, index) => {
    group();
    const id = `checkout-accessory-${index + 1}`;
    add(`${id}-number-board`, [f.x, 2.3, 35.2], [1.4, .1, .8], '#2e6455');
    add(`${id}-sign-post`, [f.x, 1.1, 35.2], [.07, 2.2, .07], steel);
    add(`${id}-sign-foot`, [f.x, .045, 35.2], [.32, .09, .32], dark);
  });
  // Short impulse tables occupy the checkout band's front edge, not the z[29,34] cross aisle.
  // They are generic decorative product blocks, never priced stock or operational fixtures.
  if (lanes.length === 24) for (let index = 0; index < 6; index++) {
    group();
    const x = 2.5 + index * 10.7;
    add(`checkout-accessory-display-${index}-base`, [x, .45, 34.6], [3.2, .9, .7], '#c9b78e');
    add(`checkout-accessory-display-${index}-top`, [x, .96, 34.6], [3.3, .12, .8], '#eee5cc');
    for (let box = 0; box < 4; box++) add(`checkout-accessory-display-${index}-pack-${box}`, [x - 1.12 + box * .75, 1.2, 34.6], [.58, .36, .5], box % 2 ? '#b29456' : '#8caa8b');
  }
  const occupied: OBB[] = fixtures.map((f) => ({ cx: f.x, cz: f.z, ux: Math.cos(f.rotationY), uz: -Math.sin(f.rotationY), hl: f.widthM / 2, hw: f.depthM / 2 }));
  return clusters.filter((cluster) => !cluster.some((p) => occupied.some((f) => obbsOverlap({ cx: p.position[0], cz: p.position[2], ux: 1, uz: 0, hl: p.size[0] / 2, hw: p.size[2] / 2 }, f)))).flat();
}
