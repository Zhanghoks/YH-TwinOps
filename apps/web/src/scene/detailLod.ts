import { supportsShelfPlanogram, type DetailPart, type DetailFixtureShape } from './detailGeometry';
export type DetailLod = 'near' | 'far';
/** Hysteresis keeps orbit/zoom near the threshold from reallocating instance buffers. */
export function nextDetailLod(current:DetailLod,cameraHeight:number):DetailLod {
 if(!Number.isFinite(cameraHeight))return current;
 return current==='near' ? cameraHeight>35?'far':'near' : cameraHeight<28?'near':'far';
}
/** Distance to each fixture, not camera height alone: low skyline cameras can
 * look past nearby fixtures at distant full-store geometry. 45/60m hysteresis.
 */
export function fixtureDetailLod(current:DetailLod,camera:readonly[number,number,number],fixture:DetailFixtureShape,selected=false):DetailLod {
 if(selected||fixture.fixtureId.startsWith('design-sample'))return 'near';
 const distance=Math.hypot(camera[0]-fixture.x,camera[1]-fixture.y-fixture.heightM/2,camera[2]-fixture.z);
 if(!Number.isFinite(distance))return current;
 // Dense individual merchandise is restored only in a genuinely close aisle view.
 if(supportsShelfPlanogram(fixture))return current==='near'?(distance>13?'far':'near'):(distance<9?'near':'far');
 return current==='near'?(distance>60?'far':'near'):(distance<45?'near':'far');
}
/** Named micro geometry is auxiliary to a separate retained product body. */
export function isMicroDetail(part:DetailPart):boolean {
 return /^(bottle-neck-|bottle-cap-|pack-(?:bottle|jar|pouch|sack)-base-|pack-pouch-crimp-|jar-lid-|chilled-neck-|chilled-cap-|bread-score-|bakery-upper-score-|vegetable-leaf-|pack-label-|package-stripe-|vent-slot-)/.test(part.id);
}
/** Preserve every product body, display bed and structural frame. Only sub-pixel
 * labels and tiny hardware go away at overview scale; input/IDs are never changed.
 * Selected fixtures and design samples use the untouched near representation.
 */
export function detailPartsAtLod(parts:DetailPart[],lod:DetailLod):DetailPart[] {
 if(lod==='near')return parts;
 return parts.filter(part=>{
  if(isMicroDetail(part))return false;
  const longest=Math.max(...part.size);
  if(part.material==='label')return longest>=.32;
  if(part.material==='metal'||part.material==='rubber')return longest>=.12;
  return true;
 });
}
/** SphereGeometry(8,6) uses 80 triangles; distant octahedra use 8. */
export function detailTriangleBudget(parts:DetailPart[],lod:DetailLod):number {
 return detailPartsAtLod(parts,lod).reduce((sum,p)=>sum+(p.primitive==='box'?12:lod==='far'?8:80),0);
}
export type BoxSides='pp'|'pn'|'np'|'nn';
/** Only for distant opaque boxes seen above the full fixture. Local coordinates
 * account for the fixture rotation; retain full boxes below the top envelope.
 */
export function distantBoxSides(camera:readonly[number,number,number],fixture:DetailFixtureShape):BoxSides|undefined {
 if(camera[1]<=fixture.y+fixture.heightM+2)return undefined;
 const dx=camera[0]-fixture.x,dz=camera[2]-fixture.z,c=Math.cos(fixture.rotationY),s=Math.sin(fixture.rotationY);
 const x=dx*c-dz*s,z=dx*s+dz*c;
 if(Math.abs(x)<=fixture.widthM/2||Math.abs(z)<=fixture.depthM/2)return undefined;
 return `${x>=0?'p':'n'}${z>=0?'p':'n'}` as BoxSides;
}
/** BoxGeometry face order +X,-X,+Y,-Y,+Z,-Z; each face has six indices. */
export function visibleBoxFaceIndices(sides:BoxSides):number[] {
 return [sides[0]==='p'?0:1,2,sides[1]==='p'?4:5];
}
