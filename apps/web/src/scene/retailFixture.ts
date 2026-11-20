/** Empty teaching assets. Millimeter inputs; output X across, Y up, +Z customer side in meters. */
export type RetailFixtureKind = 'produce'|'service'|'checkout';
export type RetailFixtureDetail = 'high'|'low';
export type RetailVec3 = readonly [number,number,number];
export type RetailFinish = 'body'|'wood'|'steel'|'dark'|'trim'|'glass'|'rubber'|'screen';
export interface RetailFixtureDimensionsMm {width:number;depth:number;height:number}
export interface RetailPart {
  id:string;
  finish:RetailFinish;
  min:RetailVec3;
  max:RetailVec3;
  /** Convex Y/Z section extruded along the part's X span; omitted for a box. */
  profile?:readonly (readonly [number,number])[];
}
export interface RetailMount {
  id:string;
  role:'produce-bin'|'service-tray'|'conveyor'|'bagging';
  side:'front'|'back'|'operator';
  supportId:string;
  anchor:RetailVec3;
  size:RetailVec3;
  /** Right-handed rotation around X. Zero for horizontal supports. */
  pitchRad:number;
}
export interface RetailFixtureModel {
  kind:RetailFixtureKind;
  detail:RetailFixtureDetail;
  dimensionsMm:RetailFixtureDimensionsMm;
  parts:readonly RetailPart[];
  mounts:readonly RetailMount[];
}
export const RETAIL_FIXTURE_DEFAULTS:Readonly<Record<RetailFixtureKind,RetailFixtureDimensionsMm>>={
  produce:{width:1220,depth:1450,height:940},
  service:{width:1955,depth:1086,height:1290},
  checkout:{width:2500,depth:1120,height:1150},
};
type Mm=[number,number,number];
const m=([x,y,z]:Mm):RetailVec3=>[x/1000,y/1000,z/1000];

export function buildRetailFixture(kind:RetailFixtureKind,overrides:Partial<RetailFixtureDimensionsMm>={},detail:RetailFixtureDetail='high'):RetailFixtureModel{
  const dimensionsMm={...RETAIL_FIXTURE_DEFAULTS[kind],...overrides};
  const {width:w,depth:d,height:h}=dimensionsMm;
  if (![w,d,h].every(Number.isFinite)||w<1050||w>4500||d<650||d>2000||h<900||h>1950) throw new RangeError('Unsupported teaching fixture envelope dimensions');
  const x=w/2,z=d/2;
  const parts:RetailPart[]=[];
  const mounts:RetailMount[]=[];
  const b=(id:string,finish:RetailFinish,min:Mm,max:Mm):void=>{parts.push({id,finish,min:m(min),max:m(max)});};
  const prism=(id:string,finish:RetailFinish,a:number,c:number,profile:readonly (readonly [number,number])[]):void=>{
    const y=profile.map(p=>p[0]),zz=profile.map(p=>p[1]);
    parts.push({id,finish,min:m([a,Math.min(...y),Math.min(...zz)]),max:m([c,Math.max(...y),Math.max(...zz)]),profile:profile.map(([py,pz])=>[py/1000,pz/1000])});
  };
  const mount=(id:string,role:RetailMount['role'],side:RetailMount['side'],supportId:string,anchor:Mm,size:Mm,pitchRad=0):void=>{
    mounts.push({id,role,side,supportId,anchor:m(anchor),size:m(size),pitchRad});
  };
  const feet=():void=>{
    for(const a of [-1,1])for(const c of [-1,1]){
      const px=a*(x-64),pz=c*(z-65);
      b(`foot-${a}-${c}`,'dark',[px-26,0,pz-21],[px+26,34,pz+21]);
    }
  };
  if(kind!=='checkout') feet();

  if(kind==='produce'){
    const yBack=h-26,zBack=38,zFront=z-32;
    const slope=Math.tan(Math.PI/18); // nominal 10° downslope towards the shopper
    const yFront=yBack-(zFront-zBack)*slope;
    const trayWidth=(w-88)/4;
    b('island-plinth','dark',[-x+45,34,-z+63],[x-45,118,z-63]);
    b('island-body','body',[-x,118,-z+18],[x,yFront-20,z-18]);
    b('central-spine','wood',[-x+28,yFront-24,-zBack],[x-28,h,zBack]);
    for(const side of [-1,1] as const){
      const zs=side===1?[z-33,z]:[-z,-z+33];
      b(`front-retainer-${side}`,'wood',[-x,yFront-21,zs[0]??0],[x,yFront+55,zs[1]??0]);
      for(let bay=0;bay<4;bay++){
        const a=-x+44+bay*trayWidth,c=a+trayWidth;
        const bed=`sloped-bin-bed-${side}-${bay}`;
        prism(bed,'wood',a+8,c-8,[[yBack-18,side*zBack],[yFront-18,side*zFront],[yFront,side*zFront],[yBack,side*zBack]]);
        const rim=(x0:number,name:string):void=>{
          prism(`${bed}-${name}`,'trim',x0,x0+8,[[yBack-4,side*zBack],[yFront-4,side*zFront],[yFront+53,side*zFront],[h,side*zBack]]);
        };
        rim(a,'left-divider');
        if(bay===3)rim(c-8,'right-divider');
        if(detail==='high'){
          const retainerMin=side===1?z-5:-z;
          b(`blank-price-clip-${side}-${bay}`,'steel',[(a+c)/2-58,yFront+11,retainerMin],[(a+c)/2+58,yFront+35,retainerMin+5]);
        }
        // Local U/Y/V case: frame goes into the clear center of the sloped bed.
        // This preserves contact for a separately modeled product's bottom surface.
        mount(`produce-${side}-${bay}`,'produce-bin',side===1?'front':'back',bed,
          [(a+c)/2,(yBack+yFront)/2,side*(zFront+zBack)/2],
          [trayWidth-58,155,Math.hypot(zFront-zBack,yBack-yFront)-120],Math.atan(side*slope));
      }
    }
  }

  if(kind==='service'){
    const bed=Math.round(h*.657),crown=h-20;
    const serviceFace=-z+30,frontGlass=z-20,glassIn=frontGlass-110;
    const innerSide=-x+55,end=x-55;
    b('insulated-base','body',[-x,115,-z],[x,bed,z-8]);
    b('setback-kickplate','dark',[-x+22,34,-z+22],[x-22,115,z-22]);
    b('front-brand-free-fascia','trim',[-x+16,145,z-8],[x-16,bed-18,z]);
    const trayTop=bed+18;
    for(const sx of [-1,1]){
      const a=sx===1?x-43:-x,c=a+43;
      b(`end-tray-support-${sx}`,'steel',[a,bed,-z],[c,trayTop,z]);
      prism(`end-shield-${sx}`,'glass',a+6,c-6,[[trayTop,serviceFace],[trayTop,frontGlass],[crown-45,frontGlass],[crown,glassIn],[crown,serviceFace]]);
      b(`rear-canopy-post-${sx}`,'steel',[a,trayTop,serviceFace],[c,crown,serviceFace+23]);
    }
    const glassStart=trayTop+8,glassEnd=crown-24;
    // Fabricated arc silhouette approximated by six planar segments; assigned a
    // single transparent part, not stacked overlapping glass sheets.
    const arc=Array.from({length:7},(_,i):readonly[number,number]=>{
      const t=i/6;
      return [glassStart+(glassEnd-glassStart)*t,frontGlass-(frontGlass-glassIn)*t*t];
    });
    prism('curved-front-glass','glass',innerSide,end,[...arc,...[...arc].reverse().map(([py,pz])=>[py,pz-6] as const)]);
    b('glass-top','glass',[innerSide,crown-10,serviceFace+23],[end,crown-4,glassIn+5]);
    b('canopy-top-front-rail','steel',[-x,crown-24,glassIn-9],[x,h,glassIn+9]);
    b('canopy-top-rear-rail','steel',[-x,crown-15,serviceFace],[x,crown,serviceFace+23]);
    b('glass-lower-rail','steel',[-x,bed,frontGlass-10],[x,trayTop+14,frontGlass+9]);
    b('rear-operation-deck','steel',[innerSide,bed,-z],[end,trayTop,-z+236]);
    const extent=end-innerSide,step=extent/4;
    const tBack=-z+236,tFront=glassIn-17;
    for(let i=0;i<4;i++){
      const a=innerSide+i*step+5,c=a+step-10;
      const support=`stainless-tray-${i}`;
      b(support,'steel',[a,bed,tBack],[c,trayTop,tFront]);
      for(const [j,z0] of [tBack,tFront-9].entries()){
        b(`tray-lip-${i}-${j}`,'steel',[a,trayTop,z0],[c,trayTop+16,z0+9]);
      }
      for(const [j,x0] of [a,c-9].entries()){
        b(`tray-end-${i}-${j}`,'steel',[x0,trayTop,tBack+9],[x0+9,trayTop+16,tFront-9]);
      }
      mount(`display-tray-${i}`,'service-tray','front',support,[(a+c)/2,trayTop,(tBack+tFront)/2],
        [c-a-32,crown-55-trayTop,tFront-tBack-29]);
    }
    if(detail==='high') b('canopy-light-strip','steel',[innerSide+20,crown-20,glassIn-27],[end-20,crown-13,glassIn-18]);
  }

  if(kind==='checkout'){
    const deck=Math.round(h*860/1150)-9,zBack=-z+96,zFace=z-28;
    const scanX=-w*.06,infeedLeft=-x+18,infeedRight=scanX-103;
    const packLeft=scanX+135;
    // Separate base pods leave a visibly recessed knee/toe zone on the staff
    // side. The customer edge and equipment overall dimensions stay fixed.
    const podHeight=deck-28;
    b('infeed-support-pod','body',[-x+30,46,-z+190],[infeedRight-25,podHeight,z-25]);
    b('operator-console-support','body',[infeedRight+16,46,-z+228],[packLeft-20,podHeight,z-32]);
    b('bagging-support-pod','body',[packLeft+95,46,-z+112],[x-55,podHeight,z-58]);
    for(const [i,[a,c,back,front]] of [
      [-x+38,infeedRight-32,-z+202,z-34],
      [infeedRight+26,packLeft-28,-z+237,z-42],
      [packLeft+105,x-67,-z+124,z-68],
    ].entries()){
      if(a===undefined||c===undefined||back===undefined||front===undefined)continue;
      b(`equipment-toe-${i}`,'dark',[a,18,back],[c,46,front]);
      for(const [j,p] of [a+12,c-12].entries())b(`equipment-foot-${i}-${j}`,'dark',[p-12,0,front-38],[p+12,18,front-11]);
    }
    b('conveyor-frame','steel',[-x,podHeight,zBack-18],[infeedRight,deck,z]);
    b('black-checkout-belt','rubber',[infeedLeft,deck,zBack],[infeedRight-15,deck+9,zFace]);
    for(const [i,zRail] of [zBack-13,zFace].entries()){
      b(`conveyor-edge-rail-${i}`,'steel',[infeedLeft,deck,zRail],[infeedRight-15,deck+19,zRail+13]);
    }
    b('scanner-housing','steel',[infeedRight,podHeight,-z],[packLeft,deck+9,z]);
    b('scanner-window','dark',[scanX-75,deck+9,-54],[scanX+83,deck+11,90]);
    b('scanner-reader-inset','screen',[scanX-63,deck+11,-40],[scanX+70,deck+12,76]);
    b('bagging-deck','steel',[packLeft,podHeight,-z],[x,deck+9,z]);
    for(const side of [-1,1] as const) {
      const e=side===1?z-13:-z;
      b(`bagging-edge-${side}`,'trim',[packLeft,deck+9,e],[x,deck+32,e+13]);
    }
    b('bagging-end-rail','trim',[x-15,deck+9,-z+13],[x,deck+32,z-13]);
    b('operator-terminal-stand','dark',[scanX-35,deck+11,-z+25],[scanX+23,h-75,-z+75]);
    b('operator-terminal-housing','dark',[scanX-88,h-75,-z+17],[scanX+88,h,-z+77]);
    b('operator-terminal-display','screen',[scanX-75,h-64,-z+13],[scanX+75,h-9,-z+17]);
    b('customer-payment-pad','dark',[scanX-60,deck+9,z-132],[scanX+60,deck+50,z-28]);
    b('customer-payment-screen','screen',[scanX-44,deck+50,z-110],[scanX+44,deck+52,z-51]);
    if(detail==='high'){
      for(let j=0;j<3;j++)for(let i=0;i<2;i++){
        b(`payment-key-${j}-${i}`,'steel',[scanX+6+i*13,deck+52,z-80+j*8],[scanX+16+i*13,deck+54,z-74+j*8]);
      }
    }
    const mx=(a:number,c:number)=>(a+c)/2;
    const beltEnd=infeedRight-15;
    mount('checkout-infeed','conveyor','front','black-checkout-belt',[mx(infeedLeft,beltEnd),deck+9,mx(zBack,zFace)],[beltEnd-infeedLeft-30,220,zFace-zBack-28]);
    mount('checkout-bagging','bagging','operator','bagging-deck',[mx(packLeft,x-15),deck+9,0],[x-15-packLeft-34,260,d-46]);
  }
  return {kind,detail,dimensionsMm,parts,mounts};
}
