export type CameraView = 'overview' | 'top' | 'entrance' | 'site' | 'sky' | 'urbanInterior' | 'f032' | 'F029' | 'F050' | 'F077' | 'F107' | 'F074' | 'F007' | 'F120';
export function buildSceneCamera(view: CameraView, center: readonly [number, number], depth: number, width = 80): { position: [number, number, number]; target: [number, number, number] } {
  const pilots:Record<string,readonly[number,number]>={F029:[-59,8],F050:[-17,-29.6],F077:[-20,-10.8],F107:[37,-3],F074:[52,-28],F007:[-34,-29],F120:[-1.25,39.75]};
  const p=pilots[view];
  if(p && view==='F007')return {position:[p[0]+12,9,p[1]+16],target:[p[0],.7,p[1]]};
  if(p)return {position:[p[0]+8,7,p[1]+11],target:[p[0],.8,p[1]]};
  if (view === 'f032') return {position:[17,6.5,36],target:[9,.8,26.25]};
  const [x, z] = center;
  const scale = Math.max(depth / 50, width / 80);
  if (view === 'urbanInterior') return {position:[x-17,15,z+depth/2+57],target:[x-24,1.4,z+depth/2+79]};
  if (view === 'sky') return { position: [x+width*.35,22,z+depth/2+44],target:[x,27,z-depth/2-60] };
  if (view === 'site') return { position: [x + 65*scale, 110*scale, z + 135*scale], target: [x,0,z+15] };
  if (view === 'entrance') return { position: [x + 12 * scale, 19 * scale, z + depth / 2 + 24 * scale], target: [x, 1.2, z + depth / 2 - 8 * scale] };
  if (view === 'top') return { position: [x, (width === 130 && depth === 100 ? 166.25 : 115 * Math.max(depth / 62.5, width / 80)), z + .1], target: [x, 0, z] };
  return { position: [x + 48 * scale, 64 * scale, z + 78 * scale], target: [x, 0, z] };
}

/** Fit the floor to the actual canvas, reserving room for the top/bottom controls. */
export function fitTopViewHeight(widthM: number, depthM: number, viewportWidth: number, viewportHeight: number, fov = 42): number {
  const h = Math.max(1, viewportHeight), w = Math.max(1, viewportWidth);
  const usableW = Math.max(w * .6, w - 48), usableH = Math.max(h * .6, h - 150);
  const tan = Math.tan(fov * Math.PI / 360);
  return Math.max((widthM + 6) * h / (2 * tan * usableW), (depthM + 6) * h / (2 * tan * usableH));
}

/** Exterior entrance inspection targets the actual reference entrance, not store centre. */
export function buildEntranceSiteCamera(center: readonly [number,number],depth:number,entryOffsetX:number): {position:[number,number,number];target:[number,number,number]} {
  const x=center[0]+entryOffsetX,z=center[1]+depth/2;
  return {position:[x+13,18,z+36],target:[x,1.5,z+3]};
}
