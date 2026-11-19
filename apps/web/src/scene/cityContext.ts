import type { ArchitecturePart } from './storeArchitecture';
/** Generic, deliberately low-poly neighbourhood. Never business-layout data. */
export function buildCityContext(width:number,depth:number):ArchitecturePart[] {
  if(![width,depth].every(n=>Number.isFinite(n)&&n>=20))throw new RangeError('Invalid city dimensions');
  const out:ArchitecturePart[]=[];
  const add=(id:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,primitive:'box'|'sphere'='box')=>out.push({id:`city-${id}`,primitive,position:[x,y,z],size:[sx,sy,sz],color});
  const building=(id:string,x:number,z:number,w:number,d:number,h:number,index:number)=>{
    const colors=['#aeb8b8','#c4bcae','#9baeb6','#b9b4a6'];
    add(`${id}-base`,x,.12,z,w+4,.24,d+4,'#b6bcb4');
    add(`${id}-body`,x,h/2,z,w,h,d,colors[index%4]!);
    add(`${id}-roof`,x,h+.25,z,w+.5,.5,d+.5,'#8c9896');
    add(`${id}-plant`,x-w*.2,h+1.2,z,w*.25,2,d*.3,'#81908d');
    // Large horizontal window bands, not thousands of individual glass panes.
    for(let y=3;y<h-1;y+=4) {
      for(const side of [-1,1]) {
        add(`${id}-front-${y}-${side}`,x,y,z+side*(d/2+.12),w*.82,1.4,.06,'#66818d');
        add(`${id}-side-${y}-${side}`,x+side*(w/2+.12),y,z,.06,1.4,d*.78,'#66818d');
      }
    }
  };
  // Taller blocks stay north/east/west; the south uses low cutaway pavilions.
  for(const side of [-1,1])for(let i=0;i<5;i++) {
    const x=side*(width/2+49),z=(i-2)*28;
    building(`local-${side}-${i}`,x,z,21,21,10+(i%3)*5,i+(side+1));
  }
  for(let i=0;i<7;i++)building(`north-${i}`,(i-3)*30,-depth/2-42,23,22,14+(i%3)*7,i);
  // A second street separates the near buildings from the distant skyline.
  add('avenue',0,-.055,-depth/2-67,width+180,.08,12,'#697477');
  for(let i=0;i<30;i++)add(`avenue-dash-${i}`,(i-15)*10,.005,-depth/2-67,4,.015,.16,'#d1d6c9');
  for(let i=0;i<11;i++)building(`skyline-${i}`,(i-5)*30,-depth/2-104-(i%2)*13,17+(i%3)*3,22,25+(i%4)*13,i+2);
  for(const side of [-1,1]) {
    add(`cross-road-${side}`,side*(width/2+69),-.055,-25,9,.08,depth+170,'#697477');
    add(`urban-green-${side}`,side*(width/2+30),-.04,-10,6,.06,depth+40,'#819376');
  }
  // A southern cross street closes the surrounding road network. The existing
  // side roads end at depth/2+60, so this ten-metre strip overlaps both ends.
  add('south-avenue',0,-.055,depth/2+59,width+147,.08,10,'#697477');
  for(let i=0;i<24;i++)add(`south-avenue-dash-${i}`,(i-11.5)*(width+132)/24,.005,depth/2+59,3.5,.015,.16,'#d1d6c9');
  add('south-promenade',0,.035,depth/2+67,width+144,.07,5,'#c6c5b9');
  // Six shallow, explicitly roofless architectural cutaways expose actual
  // furniture and floor geometry. They are not surveyed/occupied real shops.
  // No south-side towers: keep the operational camera's view of the store clear.
  for(let i=0;i<6;i++) {
    const x=(i<3?i-3:i-2)*24,z=depth/2+79,id=`south-interior-${i}`;
    const w=18,d=14,h=3.6;
    add(`${id}-floor`,x,.14,z,w,.28,d,'#c2b8a2');
    add(`${id}-back-wall`,x,h/2,z+d/2-.12,w,h,.24,'#dad6c6');
    for(const side of [-1,1]) {
      add(`${id}-side-wall-${side}`,x+side*(w/2-.12),h/2,z,.24,h,d,'#c9cdc3');
      add(`${id}-front-post-${side}`,x+side*(w/2-.35),h/2,z-d/2,.24,h,.24,'#6c817a');
    }
    add(`${id}-front-fascia`,x,h-.2,z-d/2,w,.4,.3,['#638477','#8b816c','#647d8c'][i%3]!);
    // Central circulation aisle remains clear between counter and seats/desks.
    add(`${id}-counter`,x-5.6,.8,z+2.8,3.8,1.3,1.4,'#a18a68');
    add(`${id}-counter-top`,x-5.6,1.49,z+2.8,4,.10,1.6,'#e1ddd1');
    add(`${id}-screen`,x-5.6,1.86,z+2.9,.65,.55,.10,'#384e54');
    add(`${id}-rear-shelf`,x+4,1.25,z+5.8,5,2,.42,'#8c9d8b');
    for(let shelf=0;shelf<3;shelf++) {
      add(`${id}-shelf-board-${shelf}`,x+4,.55+shelf*.6,z+5.45,5,.08,1,'#bea681');
      for(let book=0;book<4;book++)add(`${id}-stock-${shelf}-${book}`,x+2.3+book*1.1,.79+shelf*.6,z+5.4,.7,.4,.48,['#b88e66','#b8c4af','#8eaaa9'][book%3]!);
    }
    for(let t=0;t<2;t++) {
      const tx=x+3.3,tz=z-3+t*4;
      add(`${id}-table-top-${t}`,tx,1.05,tz,2.6,.14,1.6,'#bfa579');
      for(const dx of [-1,1])add(`${id}-table-leg-${t}-${dx}`,tx+dx,.58,tz,.14,.86,1.2,'#66776b');
      for(const side of [-1,1]) {
        add(`${id}-seat-${t}-${side}`,tx+side*2,.6,tz,.85,.14,.9,'#779087');
        add(`${id}-seat-leg-${t}-${side}`,tx+side*2,.3,tz,.32,.46,.5,'#66776b');
        add(`${id}-seat-back-${t}-${side}`,tx+side*2.4,1,tz,.12,.7,.9,'#779087');
      }
    }
    // Flat interior rug and a partition distinguish each room from an empty box.
    add(`${id}-rug`,x+3,.29,z-1,5,.018,7,'#9daea6');
    add(`${id}-partition`,x-2.6,1.2,z+3,.14,1.8,3,'#bdc8b8');
  }
  // Low-cost far blocks provide a horizon on every side without tall foreground
  // occluders. Their podiums sit within the existing expanded ground footprint.
  for(const side of [-1,1])for(let i=0;i<5;i++) {
    const x=side*(width/2+109),z=(i-2)*36,h=11+(i%3)*5;
    add(`far-side-${side}-${i}`,x,h/2,z,18,h,24,'#9aa9a6');
    add(`far-side-cap-${side}-${i}`,x,h+.15,z,18.4,.3,24.4,'#839590');
  }
  for(let i=0;i<7;i++) {
    const x=(i-3)*27,z=depth/2+120,h=7+(i%3)*2;
    add(`far-south-${i}`,x,h/2,z,19,h,18,'#a7b0a3');
    add(`far-south-cap-${i}`,x,h+.15,z,19.4,.3,18.4,'#8c9c90');
  }
  // Connected forecourt: a pedestrian route and planted public square, not vacant paving.
  add('plaza-green',0,-.02,depth/2+38,width*.70,.04,22,'#637f52');
  add('plaza-cross-path',0,.015,depth/2+38,width*.76,.03,3.6,'#b3b19a');
  add('plaza-entry-path',-22.5,.025,depth/2+40,5,.05,38,'#b8b6a2');
  for(const side of [-1,1])for(let i=0;i<5;i++) {
    const x=side*(13+i*8),z=depth/2+30+(i%2)*15;
    add(`square-tree-trunk-${side}-${i}`,x,1.4,z,.35,2.8,.35,'#766e55');
    add(`square-tree-crown-${side}-${i}`,x,3.2,z,3.5,3.4,3.5,'#587848','sphere');
    add(`square-bench-${side}-${i}`,x,.5,z+3,2.8,.22,.7,'#9c8766');
  }
  for(const side of [-1,1]) {
    const x=side*width*.35,z=depth/2+53;
    add(`bus-shelter-roof-${side}`,x,3,z,8,.18,3,'#557a74');
    add(`bus-shelter-back-${side}`,x,1.5,z+1.3,8,2.8,.12,'#839d9d');
    for(const dx of [-3.5,3.5])add(`bus-shelter-post-${side}-${dx}`,x+dx,1.5,z-1,.12,3,.12,'#465b53');
    add(`bus-shelter-seat-${side}`,x,.6,z+.7,6,.16,.6,'#a39c81');
  }
  // A continuous shopfront walkway/awning ties the six cutaways into one street.
  add('shopfront-walk',0,.04,depth/2+70,164,.08,5,'#b8b6a4');
  for(let i=0;i<6;i++) {
    const x=(i<3?i-3:i-2)*24,z=depth/2+71;
    add(`shopfront-awning-${i}`,x,3.35,z,19,.14,2.5,['#547968','#93745c','#5d7986'][i%3]!);
  }
  return out;
}
