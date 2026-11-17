/** Decorative cutaway shell only; never a measured wall or a navigation collider. */
export interface ArchitecturePart {
  id: string;
  primitive: 'box' | 'sphere';
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive?: boolean;
  transparent?: boolean;
}

/** Generic retail architecture inspired by reference composition, without logos or real-world claims. */
export function buildStoreArchitecture(width: number, depth: number): ArchitecturePart[] {
  if (![width, depth].every((v) => Number.isFinite(v) && v > 0)) {
    throw new RangeError('Store dimensions must be finite and positive');
  }
  const parts: ArchitecturePart[] = [];
  const scale = Math.min(1, width / 8, depth / 8);
  const add = (id: string, position: ArchitecturePart['position'], size: ArchitecturePart['size'], color: string, extra: Partial<Pick<ArchitecturePart, 'emissive' | 'transparent' | 'primitive'>> = {}): void => {
    parts.push({ id, primitive: 'box', position, size, color, ...extra });
  };
  const front = depth / 2 + .23 * scale;
  const back = -depth / 2 - .23 * scale;
  const dark = '#444640', cream = '#e9e1ce';
  // A shallow red retail fascia provides orientation; centre entry remains open below it.
  add('front-fascia', [0, 2.9 * scale, front], [width + .5 * scale, 1.0 * scale, .3 * scale], '#b82d38');
  add('front-fascia-cap', [0, 3.42 * scale, front], [width + .52 * scale, .045 * scale, .38 * scale], cream);
  add('front-warm-light', [0, 2.36 * scale, front], [width, .035 * scale, .08 * scale], '#ffe8b5', { emissive: true });
  const frontBays = Math.min(14, Math.max(4, Math.ceil(width / 5)));
  const bayWidth = width / frontBays;
  const entryHalfWidth = Math.min(width * .13, 4);
  for (let i = 0; i < frontBays; i++) {
    const x = -width / 2 + (i + .5) * bayWidth;
    if (Math.abs(x) < entryHalfWidth) continue;
    const id = `front-${i}`;
    add(`${id}-sill`, [x, .1 * scale, front], [bayWidth * .94, .2 * scale, .27 * scale], dark);
    add(`${id}-glazing`, [x, .7 * scale, front], [bayWidth * .92, 1.0 * scale, .04 * scale], '#b7d7d3', { transparent: true });
    add(`${id}-handrail`, [x, 1.23 * scale, front], [bayWidth * .96, .055 * scale, .07 * scale], cream);
    add(`${id}-mullion`, [x - bayWidth * .47, 1.35 * scale, front], [.065 * scale, 2.7 * scale, .08 * scale], dark);
  }
  // Exterior approach only: decorative paving is flush, with a clear central entry lane.
  // These are not measured accessibility dimensions and never become navigation colliders.
  const apronZ = depth / 2 + 3.1 * scale;
  add('entrance-apron', [0, .025 * scale, apronZ], [width + .8 * scale, .05 * scale, 5.8 * scale], '#c9c3b5');
  for (let row = 0; row < 5; row++) {
    add(`entrance-paving-cross-${row}`, [0, .053 * scale, depth / 2 + (1 + row) * scale], [width + .75 * scale, .004 * scale, .018 * scale], '#aaa99c');
  }
  const pavingBays = Math.min(24, Math.max(4, Math.ceil(width / 3)));
  for (let i = 1; i < pavingBays; i++) {
    add(`entrance-paving-joint-${i}`, [-width / 2 + i * width / pavingBays, .053 * scale, apronZ], [.018 * scale, .004 * scale, 5.75 * scale], '#aaa99c');
  }
  for (const side of [-1, 1]) {
    const planterX = side * width * .36;
    const planterWidth = Math.min(width * .18, 6);
    const planterZ = depth / 2 + 4.4 * scale;
    add(`entrance-planter-${side}`, [planterX, .28 * scale, planterZ], [planterWidth, .56 * scale, 1.15 * scale], '#a99678');
    add(`entrance-planter-soil-${side}`, [planterX, .57 * scale, planterZ], [planterWidth * .94, .035 * scale, 1.04 * scale], '#4c4f37');
    for (let i = 0; i < 3; i++) {
      add(`entrance-planter-shrub-${side}-${i}`, [planterX + (i - 1) * planterWidth * .28, .88 * scale, planterZ], [planterWidth * .31, .76 * scale, .98 * scale], i === 1 ? '#708e46' : '#527a40', { primitive: 'sphere' });
    }
    const rackX = side * width * .22;
    const rackWidth = Math.min(width * .10, 3.8);
    const rackZ = depth / 2 + 2.2 * scale;
    // An open steel cart corral, not a solid box or a claim about actual cart inventory.
    add(`entrance-cart-rack-${side}-base`, [rackX, .08 * scale, rackZ], [rackWidth, .08 * scale, 1.6 * scale], '#9a9e97');
    for (const edge of [-1, 1]) {
      for (const end of [-1, 1]) {
        add(`entrance-cart-rack-${side}-post-${edge}-${end}`, [rackX + edge * rackWidth * .46, .48 * scale, rackZ + end * .73 * scale], [.045 * scale, .8 * scale, .045 * scale], '#78817e');
      }
      add(`entrance-cart-rack-${side}-rail-${edge}`, [rackX + edge * rackWidth * .46, .89 * scale, rackZ], [.055 * scale, .055 * scale, 1.55 * scale], '#bcc4bd');
    }
    add(`entrance-cart-rack-${side}-back`, [rackX, .89 * scale, rackZ - .73 * scale], [rackWidth * .96, .055 * scale, .055 * scale], '#bcc4bd');
    add(`entrance-cart-rack-${side}-marker`, [rackX, .8 * scale, rackZ - .74 * scale], [rackWidth * .46, .25 * scale, .035 * scale], '#507264');
  }
  // Side windows are deliberately waist-height in the cutaway, preserving the operational view.
  const sideBays = Math.min(10, Math.max(3, Math.ceil(depth / 6)));
  const sideLength = depth / sideBays;
  for (const side of [-1, 1]) {
    const x = side * (width / 2 + .23 * scale);
    add(`side-${side}-base`, [x, .11 * scale, 0], [.35 * scale, .22 * scale, depth], dark);
    add(`side-${side}-rail`, [x, 1.24 * scale, 0], [.09 * scale, .06 * scale, depth], cream);
    for (let i = 0; i < sideBays; i++) {
      const z = -depth / 2 + (i + .5) * sideLength;
      add(`side-${side}-glass-${i}`, [x, .73 * scale, z], [.04 * scale, .98 * scale, sideLength * .94], '#c4dfda', { transparent: true });
      add(`side-${side}-frame-${i}`, [x, .73 * scale, z - sideLength * .48], [.08 * scale, 1.08 * scale, .055 * scale], dark);
    }
    // Exterior planters, not new obstacles inside StoreLayout's business floor.
    for (let i = 0; i < 4; i++) {
      const z = (-.375 + i * .25) * depth;
      const px = side * (width / 2 + .88 * scale);
      add(`planter-${side}-${i}`, [px, .23 * scale, z], [.8 * scale, .46 * scale, 1.4 * scale], '#ae9c7d');
      add(`shrub-${side}-${i}-a`, [px, .62 * scale, z - .3 * scale], [.69 * scale, .75 * scale, .8 * scale], '#4c7947', { primitive: 'sphere' });
      add(`shrub-${side}-${i}-b`, [px, .65 * scale, z + .3 * scale], [.67 * scale, .8 * scale, .78 * scale], '#638d4b', { primitive: 'sphere' });
    }
  }
  add('rear-service-plinth', [0, .16 * scale, back], [width, .32 * scale, .3 * scale], dark);
  add('rear-warm-cove', [0, 3.15 * scale, back], [width, .08 * scale, .22 * scale], '#ffe0a0', { emissive: true });
  // Short rear perimeter luminaires suggest ceiling services without drawing a roof over the model.
  const lamps = Math.min(12, Math.max(3, Math.round(width / 8)));
  for (let i = 0; i < lamps; i++) {
    const x = -width / 2 + (i + .5) * width / lamps;
    add(`rear-lamp-track-${i}`, [x, 3.5 * scale, back], [Math.min(width / lamps * .65, 3), .065 * scale, .12 * scale], dark);
    add(`rear-lamp-diffuser-${i}`, [x, 3.42 * scale, back], [Math.min(width / lamps * .55, 2.5), .055 * scale, .15 * scale], '#fff1cf', { emissive: true });
  }
  return parts;
}
