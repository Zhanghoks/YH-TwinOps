import type { ArchitecturePart } from './storeArchitecture';
/** Generic non-surveyed site context; not routing, parking inventory or street geometry. */
export function buildExteriorArchitecture(width:number,depth:number,entryX=0):ArchitecturePart[] {
  if(![width,depth].every(n=>Number.isFinite(n)&&n>=20)) throw new RangeError('Exterior requires finite dimensions >=20m');
  const p:ArchitecturePart[]=[]; const w=width/2,d=depth/2;
  const add=(id:string,position:ArchitecturePart['position'],size:ArchitecturePart['size'],color:string,extra:Partial<ArchitecturePart>={})=>p.push({id,position,size,color,primitive:'box',...extra});
  const asphalt='#555e61',pave='#c4c5bd',line='#e4dfbd',green='#648256';
  add('site-road-south',[0,-.04,d+14],[width+50,.08,8],asphalt);
  add('site-road-north',[0,-.04,-d-8],[width+50,.08,8],asphalt);
  for(const side of [-1,1]) {
    add(`site-road-side-${side}`,[side*(w+7),-.04,0],[8,.08,depth+20],asphalt);
    add(`site-sidewalk-${side}`,[side*(w+1.7),.04,0],[2.8,.08,depth],pave);
    add(`site-side-curb-${side}`,[side*(w+3.2),.10,0],[.2,.20,depth], '#d9d5c7');
    for(let n=0;n<18;n++) add(`side-dash-${side}-${n}`,[side*(w+7),.012,(-.46+n*.92/17)*(depth+16)],[.12,.014,2.4],line);
  }
  add('site-plaza',[0,.025,d+8],[width,.05,4],pave);
  for(const [i,left,right] of [[0,-w,entryX-3],[1,entryX+3,w]]) if(right!>left!) add(`site-front-curb-${i}`,[(left!+right!)/2,.10,d+9.9],[right!-left!,.2,.2],'#dedacf');
  add('site-west-verge',[-w-16,-.015,0],[8,.03,depth+12],'#879975');
  add('site-parking',[w+17,-.03,0],[10,.06,depth+18],'#737b78');
  for(let i=0;i<16;i++) {
    const z=(-.46+i*.92/15)*(depth+16);
    add(`parking-line-${i}`,[w+17,.012,z],[9.5,.016,.10],line);
    if(i%3===0) {
      add(`parked-car-${i}-body`,[w+17,.67,z+1.25],[4.1,1.02,1.7],['#e0e2d9','#66818a','#a77c67'][(i/3)%3] ?? '#8c9892');
      add(`parked-car-${i}-cabin`,[w+17,1.31,z+1.25],[2.0,.55,1.5],'#8da7a9',{transparent:true});
      for(const x of [-1.35,1.35]) for(const side of [-1,1]) add(`parked-car-${i}-wheel-${x}-${side}`,[w+17+x,.34,z+1.25+side*.83],[.6,.6,.24],'#323a38',{primitive:'sphere'});
    }
  }
  for(let i=0;i<22;i++) {
    const x=(-.48+i*.96/21)*(width+46);
    if(Math.abs(x-entryX)>4) add(`south-dash-${i}`,[x,.012,d+14],[2.5,.014,.12],line);
    add(`north-dash-${i}`,[x,.012,-d-8],[2.5,.014,.12],line);
  }
  for(let i=0;i<8;i++) add(`crossing-${i}`,[entryX,.018,d+10.5+i],[5,.02,.42],'#e6e6d8');
  // Front landscape strip keeps the entrance/crossing sightline clear.
  for(const side of [-1,1]) {
    const x=side*width*.34;
    add(`front-garden-${side}`,[x,.12,d+21],[Math.min(22,width*.22),.24,3], '#9b9d84');
    add(`front-garden-soil-${side}`,[x,.25,d+21],[Math.min(21.6,width*.215),.04,2.7],green);
  }
  const tree=(id:string,x:number,z:number)=>{
    add(`${id}-bed`,[x,.17,z],[2.6,.34,2.6],'#aaa48e');
    add(`${id}-trunk`,[x,1.8,z],[.32,3.3,.32],'#7a694f');
    add(`${id}-crown`,[x,4.0,z],[3.6,3.6,3.6],green,{primitive:'sphere'});
    add(`${id}-crown-light`,[x+.65,4.5,z-.35],[2.7,2.6,2.8],'#7f995b',{primitive:'sphere'});
  };
  for(let i=0;i<8;i++) {
    const z=(-.43+i*.86/7)*depth;
    tree(`tree-east-${i}`,w+26,z); tree(`tree-west-${i}`,-w-16,z);
  }
  for(const side of [-1,1]) for(let i=0;i<3;i++) tree(`tree-front-${side}-${i}`,side*(width*.26+i*4),d+21);
  for(const side of [-1,1]) {
    const x=side*width*.35;
    add(`plaza-bench-seat-${side}`,[x,.47,d+7],[3,.10,.62],'#a88d60');
    add(`plaza-bench-back-${side}`,[x,.82,d+7.28],[3,.56,.08],'#a88d60');
    for(const dx of [-1,1]) add(`plaza-bench-foot-${side}-${dx}`,[x+dx,.23,d+7],[.12,.46,.54],'#4c5c50');
    add(`north-garden-${side}`,[side*width*.32,.06,-d-16],[Math.min(24,width*.24),.12,4],'#879975');
    for(let i=0;i<3;i++) tree(`tree-north-${side}-${i}`,side*width*.32+(i-1)*5,-d-16);
  }
  // Open roofless entry facade; canopy stays entirely outside the business floor.
  const canopyWidth=Math.min(14,width*.22);
  add('entry-canopy',[entryX,4.2,d+2.2],[canopyWidth,.22,4],'#c1b99f');
  add('entry-fascia',[entryX,3.85,d+4.12],[canopyWidth,.55,.16],'#205c46');
  add('entry-light',[entryX,4.04,d+3.3],[canopyWidth*.85,.035,.15],'#fff1cf',{emissive:true});
  for(const side of [-1,1]) add(`entry-post-${side}`,[entryX+side*(canopyWidth/2-.25),2,d+3.8],[.18,4,.18],'#58635b');
  for(const side of [-1,1]) for(let i=0;i<4;i++) {
    const x=side*(w+11.5), z=(-.4+i*.8/3)*depth;
    add(`streetlamp-${side}-${i}`,[x,2.7,z],[.13,5.4,.13],'#46534b');
    add(`streetlamp-head-${side}-${i}`,[x,5.4,z],[.8,.12,.5],'#f1e6c5',{emissive:true});
  }
  return p;
}
