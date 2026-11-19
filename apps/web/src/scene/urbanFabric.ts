import type {ArchitecturePart} from './storeArchitecture';
/** Original generic city fabric, not mapped streets, traffic routing or surveyed buildings.
 * Near-field context is reserved intact. Repeated perimeter blocks create a continuous
 * street wall rather than isolated towers on a blank display plinth.
 */
export function buildUrbanFabric(width:number,depth:number):ArchitecturePart[] {
 if(![width,depth].every(n=>Number.isFinite(n)&&n>=20))throw new RangeError('Invalid urban dimensions');
 const parts:ArchitecturePart[]=[];
 const reserveX=width/2+135,reserveZ=depth/2+150;
 const extent=Math.max(450,reserveX+150,reserveZ+150),pitch=64;
 const count=Math.floor(extent/pitch),edge=count*pitch;
 const add=(id:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string)=>parts.push({id:`fabric-${id}`,primitive:'box',position:[x,y,z],size:[sx,sy,sz],color});
 const road='#616d71',pave='#abb1ab',roof='#7e8c8c';
 // Continuous street lattice, split around the retained near-city rectangle.
 for(let n=-count;n<=count;n++) {
  const v=n*pitch;
  for(const orientation of ['x','z'] as const) {
   const crosses=orientation==='x'?Math.abs(v)<=reserveZ+5:Math.abs(v)<=reserveX+5;
   const gap=orientation==='x'?reserveX:reserveZ;
   const spans=crosses?[[-edge,-gap],[gap,edge]]:[[-edge,edge]];
   for(let s=0;s<spans.length;s++) {
    const [a,b]=spans[s]!;if(b!-a!<=0)continue;
    const c=(a!+b!)/2,len=b!-a!;
    add(`road-${orientation}-${n}-${s}`,orientation==='x'?c:v,-.045,orientation==='x'?v:c,orientation==='x'?len:10,.09,orientation==='x'?10:len,road);
    // Thin median lines are deliberately continuous at distant scale.
    add(`median-${orientation}-${n}-${s}`,orientation==='x'?c:v,.014,orientation==='x'?v:c,orientation==='x'?len:.14,.02,orientation==='x'?.14:len,'#b2b6a0');
   }
  }
 }
 // Connect the actual existing north/south/side avenues to that distant grid.
 for(const side of [-1,1]) {
  const x=side*(width/2+69);
  for(const direction of [-1,1]) {
   const start=direction===-1?-depth/2-110:depth/2+59;
   const end=direction*(edge+5),z=(start+end)/2;
   add(`connector-ns-${side}-${direction}`,x,-.025,z,9,.09,Math.abs(end-start),road);
  }
  for(const [index,z] of [-depth/2-67,depth/2+59].entries()) {
   const start=side*(width/2+69),end=side*(edge+5);
   add(`connector-ew-${side}-${index}`,(start+end)/2,-.025,z,Math.abs(end-start),.09,10,road);
  }
 }
 const palettes=['#a8b1ae','#a6a6a0','#b4b0a4','#8e9fa5','#9da9a6'];
 for(let row=-count;row<count;row++)for(let col=-count;col<count;col++) {
  const x=(col+.5)*pitch,z=(row+.5)*pitch;
  if(Math.abs(x)-30<reserveX+5&&Math.abs(z)-30<reserveZ+5)continue;
  // Reserve the connector corridors, not just the shop footprint.
  if(Math.abs(Math.abs(x)-(width/2+69))<36)continue;
  if(Math.abs(z-(-depth/2-67))<35||Math.abs(z-(depth/2+59))<35)continue;
  const block=(id:string,bx:number,y:number,bz:number,sx:number,sy:number,sz:number,color:string)=>add(id,x+(bx-x)*.875,y,z+(bz-z)*.875,sx*.875,sy,sz*.875,color);
  const k=((row+count)*17+(col+count)*31)%11,id=`block-${row}-${col}`;
  const south=z>reserveZ;
  const haze=Math.max(Math.abs(x),Math.abs(z))>330;
  const body=palettes[k%palettes.length]!;
  // A shared podium fills the street frontage; courtyard remains open above it.
  block(`${id}-pavement`,x,.08,z,62,.16,62,pave);
  block(`${id}-podium`,x,1.65,z,56,3.2,54,haze?'#a4b1ab':'#919f98');
  block(`${id}-courtyard`,x,3.28,z,21,.08,22,'#718e70');
  // Connected L-shaped street walls, with one stepped corner volume.
  const h=south?7+(k%3)*2:15+(k%4)*6;
  block(`${id}-streetwall-a`,x-20,h/2+1.6,z,12,h,54,body);
  block(`${id}-streetwall-b`,x+7,h/2+1.6,z-20,42,h,12,body);
  const h2=south?h+2:Math.min(43,h+8+(k%2)*8);
  block(`${id}-corner`,x+19,h2/2+1.6,z+17,17,h2,20,haze?'#9aa9aa':palettes[(k+2)%palettes.length]!);
  block(`${id}-roof-a`,x-20,h+1.78,z,12.6,.36,54.6,roof);
  block(`${id}-roof-b`,x+7,h+1.78,z-20,42.6,.36,12.6,roof);
  block(`${id}-roof-c`,x+19,h2+1.78,z+17,17.6,.36,20.6,roof);
  // Single facade strips suggest fenestration from a distance, avoiding dense panes.
  block(`${id}-windows-a`,x-26.12,h*.55+1.6,z,.08,Math.max(2,h*.5),46,'#6d858d');
  block(`${id}-windows-b`,x+7,h*.55+1.6,z-26.12,35,Math.max(2,h*.5),.08,'#6d858d');
 }
 return parts;
}
