import * as THREE from 'three';
import type { DimensionedShelfModel, ShelfFinish, ShelfPart } from './dimensionedShelf';

const finish: Record<ShelfFinish,{color:string;metalness:number;roughness:number}> = {
  steel:{color:'#9ca2a5',metalness:.68,roughness:.38},
  deck:{color:'#c4c8ca',metalness:.56,roughness:.38},
  rail:{color:'#e1e3e2',metalness:.52,roughness:.32},
  plinth:{color:'#414548',metalness:.23,roughness:.63},
  foot:{color:'#2e3232',metalness:.10,roughness:.83},
};
type Point = readonly [number,number,number];
const segments = [
  [-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],
] as const;

function geometryFromFaces(faces: readonly (readonly Point[])[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const face of faces) {
    const first = positions.length/3;
    for (const p of face) positions.push(...p);
    for (let i=1;i+1<face.length;i++) indices.push(first,first+i,first+i+1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** A genuine punched sheet: cell boundaries tile, rings exclude each opening,
 * front and back surfaces are bridged by aperture walls and outer metal edges.
 * No pitted texture, floating black dots, or hidden opaque plane behind holes.
 */
function sheetGeometry(part: Extract<ShelfPart,{type:'sheet'}>): THREE.BufferGeometry {
  const { min,max,cutout } = part;
  const nx=Math.max(1,Math.floor((max[0]-min[0])/cutout.pitch[0]));
  const ny=Math.max(1,Math.floor((max[1]-min[1])/cutout.pitch[1]));
  const dx=(max[0]-min[0])/nx, dy=(max[1]-min[1])/ny;
  const hx=Math.min(cutout.size[0],dx*.55)/2, hy=Math.min(cutout.size[1],dy*.55)/2;
  const faces: Point[][] = [];
  const push = (p:Point,q:Point,r:Point,s:Point): void => { faces.push([p,q,r,s]); };

  for(let v=0;v<ny;v++) for(let u=0;u<nx;u++) {
    const cx=min[0]+(u+.5)*dx, cy=min[1]+(v+.5)*dy;
    for (const [i,[ax,ay]] of segments.entries()) {
      const [bx,by] = segments[(i+1)%segments.length] ?? segments[0];
      const a = cutout.profile==='round' ? 1/Math.hypot(ax,ay) : 1;
      const b = cutout.profile==='round' ? 1/Math.hypot(bx,by) : 1;
      const outerA = (z:number):Point=>[cx+ax*dx/2,cy+ay*dy/2,z];
      const outerB = (z:number):Point=>[cx+bx*dx/2,cy+by*dy/2,z];
      const innerA = (z:number):Point=>[cx+ax*hx*a,cy+ay*hy*a,z];
      const innerB = (z:number):Point=>[cx+bx*hx*b,cy+by*hy*b,z];
      push(outerA(max[2]),outerB(max[2]),innerB(max[2]),innerA(max[2]));
      push(innerA(min[2]),innerB(min[2]),outerB(min[2]),outerA(min[2]));
      push(innerA(max[2]),innerB(max[2]),innerB(min[2]),innerA(min[2]));
    }
  }
  const border = [[min[0],min[1]],[max[0],min[1]],[max[0],max[1]],[min[0],max[1]]] as const;
  for(const [i,[ax,ay]] of border.entries()) {
    const [bx,by]=border[(i+1)%border.length] ?? border[0];
    push([ax,ay,min[2]],[bx,by,min[2]],[bx,by,max[2]],[ax,ay,max[2]]);
  }
  return geometryFromFaces(faces);
}

function bracketGeometry(part: Extract<ShelfPart,{type:'bracket'}>): THREE.BufferGeometry {
  const {min,max,side}=part;
  const back=side===1?min[2]:max[2];
  const front=side===1?max[2]:min[2];
  const h=max[1]-min[1];
  const profile: readonly (readonly [number,number])[] = [
    [max[1],back],[min[1],back],[min[1]+h*.20,back+(front-back)*.28],[max[1]-h*.17,front],[max[1],front],
  ];
  const lhs = profile.map(([y,z]):Point=>[min[0],y,z]);
  const rhs = profile.map(([y,z]):Point=>[max[0],y,z]);
  const sides:Point[][] = [lhs,[...rhs].reverse()];
  for (const [i,[y,z]] of profile.entries()) {
    const [v,w]=profile[(i+1)%profile.length] ?? [y,z];
    sides.push([[min[0],v,w],[min[0],y,z],[max[0],y,z],[max[0],v,w]]);
  }
  // Pole-supported steel profile is mirrored on the opposite face.
  return geometryFromFaces(side===1?sides.map(face=>face.reverse()):sides);
}

/** Build a self-owned Three Group that can be inspected, exported or disposed. */
export function makeDimensionedShelf(model: DimensionedShelfModel): THREE.Group {
  const group = new THREE.Group();
  group.name = model.kind==='wall'?'Single-sided wall shelf (empty)':'Double-sided two-bay gondola (empty)';
  group.userData = { dimensionsMm:model.dimensionsMm, mounts:model.mounts, detail:model.detail, storage:'Empty synthetic model, not load rated' };
  const materials = new Map<ShelfFinish,THREE.MeshStandardMaterial>();
  for (const part of model.parts) {
    const { min,max }=part;
    const g = part.type==='sheet'?sheetGeometry(part):part.type==='bracket'?bracketGeometry(part):
      new THREE.BoxGeometry(max[0]-min[0],max[1]-min[1],max[2]-min[2]);
    let material=materials.get(part.finish);
    if (!material) {
      material=new THREE.MeshStandardMaterial({ name:part.finish,...finish[part.finish] });
      materials.set(part.finish,material);
    }
    const mesh=new THREE.Mesh(g,material);
    if (part.type==='box') mesh.position.set((min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    mesh.name=part.id;
    group.add(mesh);
  }
  return group;
}

export function disposeDimensionedShelf(group: THREE.Group): void {
  const materials=new Set<THREE.Material>();
  group.traverse((node)=>{
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material)?node.material:[node.material]) materials.add(material);
  });
  for (const material of materials) material.dispose();
}
