/** Empty teaching models. Input dimensions use mm, geometry and mounting data use meters.
 * X is width, Y up, +Z the service/customer face, origin at footprint center on the ground.
 */
export type RefrigerationFixtureKind = 'island' | 'upright' | 'open';
export type RefrigerationFixtureDetail = 'high' | 'low';
export type RefrigerationVector = readonly [number, number, number];
export type RefrigerationFinish = 'body' | 'metal' | 'liner' | 'trim' | 'rail' | 'glass' | 'light';
export interface RefrigerationFixtureDimensionsMm { width:number; depth:number; height:number }
export interface RefrigerationPart {
  id:string;
  finish:RefrigerationFinish;
  min:RefrigerationVector;
  max:RefrigerationVector;
}
export interface RefrigerationMount {
  id:string;
  level:number;
  bay:number;
  /** Center of the bed, anchored at its upper surface. */
  anchor:RefrigerationVector;
  /** Usable W × clearance H × D; expands upward from anchor only. */
  size:RefrigerationVector;
  supportId:string;
}
export interface RefrigerationFixtureModel {
  kind:RefrigerationFixtureKind;
  detail:RefrigerationFixtureDetail;
  dimensionsMm:RefrigerationFixtureDimensionsMm;
  parts:readonly RefrigerationPart[];
  mounts:readonly RefrigerationMount[];
}

export const REFRIGERATION_DEFAULTS: Readonly<Record<RefrigerationFixtureKind, RefrigerationFixtureDimensionsMm>> = {
  island:{width:2502,depth:853,height:833},
  upright:{width:1350,depth:908,height:2035},
  open:{width:2580,depth:915,height:2090},
};

type Mm = [number, number, number];
const m = ([x,y,z]:Mm):RefrigerationVector=>[x/1000,y/1000,z/1000];

export function buildRefrigerationFixture(
  kind:RefrigerationFixtureKind,
  overrides:Partial<RefrigerationFixtureDimensionsMm>={},
  detail:RefrigerationFixtureDetail='high',
):RefrigerationFixtureModel {
  const dimensionsMm = {...REFRIGERATION_DEFAULTS[kind],...overrides};
  const {width:w,depth:d,height:h}=dimensionsMm;
  if (![w,d,h].every(Number.isFinite) || w<900 || w>4200 || d<580 || d>1300
    || h<(kind==='island'?650:1650) || h>(kind==='island'?1250:2700)) {
    throw new RangeError('This cooling cabinet family cannot safely fit its modeled cavity at these dimensions');
  }
  const parts:RefrigerationPart[]=[];
  const mounts:RefrigerationMount[]=[];
  const x=w/2,z=d/2;
  const b=(id:string,finish:RefrigerationFinish,min:Mm,max:Mm):void=>{
    parts.push({id,finish,min:m(min),max:m(max)});
  };
  const mount=(supportId:string,level:number,bay:number,y:number,x0:number,x1:number,z0:number,z1:number,upper:number):void=>{
    mounts.push({id:`load-${level}-${bay}`,level,bay,supportId,anchor:m([(x0+x1)/2,y,(z0+z1)/2]),size:m([x1-x0,upper-y,z1-z0])});
  };
  const feet=(offset:number):void=>{
    for (const sx of [-1,1]) for(const sz of [-1,1]) {
      const px=sx*(x-offset),pz=sz*(z-offset);
      b(`foot-${sx}-${sz}`,'trim',[px-26,0,pz-24],[px+26,18,pz+24]);
    }
  };
  const vent=(id:string,y:number,x0:number,x1:number,depth:number):void=>{
    b(`${id}-recess`,'trim',[x0,y,depth-4],[x1,y+39,depth]);
    if (detail==='high') for (let row=0;row<4;row++) {
      const py=y+5+row*9;
      b(`${id}-louvre-${row}`,'metal',[x0+5,py,depth],[x1-5,py+3,depth+2]);
    }
  };
  feet(55);

  if(kind==='island') {
    const rim=h-38, floor=Math.round(h*.25), skin=44;
    // Four insulated walls and a bottom panel define real open volume, not a solid outer box.
    b('base-pan','body',[-x+10,18,-z+10],[x-10,floor-13,z-10]);
    b('cavity-floor','liner',[-x+skin,floor-13,-z+skin],[x-skin,floor,z-skin]);
    b('front-insulated-panel','body',[-x,18,z-skin],[x,rim,z]);
    b('rear-insulated-panel','body',[-x,18,-z],[x,rim,-z+skin]);
    b('left-insulated-panel','body',[-x,18,-z+skin],[-x+skin,rim,z-skin]);
    b('right-insulated-panel','body',[x-skin,18,-z+skin],[x,rim,z-skin]);
    for(const sx of [-1,1] as const) {
      const panel0=sx===-1?-x+skin:x-skin-3;
      const panel1=panel0+3;
      b(`liner-end-${sx}`,'liner',[panel0,floor,-z+skin],[panel1,rim,z-skin]);
      const front0=sx===-1?-z+skin:z-skin-3;
      b(`liner-run-${sx}`,'liner',[-x+skin+3,floor,front0],[x-skin-3,rim,front0+3]);
      const rail0=sx===-1?-z:z-skin-9;
      const rail1=sx===-1?-z+skin+9:z;
      b(`lid-track-lower-${sx}`,'trim',[-x,rim,rail0],[x,rim+10,rail1]);
      b(`lid-track-upper-${sx}`,'rail',[-x,rim+15,rail0],[x,rim+22,rail1]);
      const end0=sx===-1?-x:x-30;
      b(`lid-end-rail-${sx}`,'rail',[end0,rim,-z+skin],[end0+30,h,z-skin]);
    }
    // Two overlap panes ride at different heights so their glass and frames never intersect.
    for(const [i,[a,c]] of [[-x+30,21],[-21,x-30]].entries()) {
      if (a===undefined||c===undefined) continue;
      const y=rim+13+i*15;
      b(`sliding-pane-${i}`,'glass',[a+10,y,-z+skin+9],[c-10,y+4,z-skin-9]);
      for (const edge of [-1,1]) {
        const pz=edge*(z-skin-8);
        b(`sliding-frame-long-${i}-${edge}`,'metal',[a,y-2,pz-7],[c,y+6,pz+7]);
        const px=edge===-1?a:c-10;
        b(`sliding-frame-short-${i}-${edge}`,'metal',[px,y-2,-z+skin+8],[px+10,y+6,z-skin-8]);
      }
      const hx=i===0?a+35:c-35;
      b(`sliding-handle-${i}`,'trim',[hx-9,y+3,-70],[hx+9,h,70]);
    }
    vent('compressor-vent',52,x-250,x-55,z-3);
    b('cavity-divider','metal',[-3,floor,-z+skin+3],[3,Math.min(floor+190,rim-25),z-skin-3]);
    mount('cavity-floor',0,0,floor,-x+skin+10,-12,-z+skin+11,z-skin-11,rim-14);
    mount('cavity-floor',0,1,floor,12,x-skin-10,-z+skin+11,z-skin-11,rim-14);
  } else {
    const upright=kind==='upright';
    const bottom=Math.round(h*.135), hood=Math.round(h*(upright?.085:.13));
    const innerTop=h-hood, side=upright?49:57, back=upright?62:99;
    const openingBack=-z+back, face=z-(upright?56:17);
    b('machinery-plinth','trim',[-x+8,18,-z+8],[x-8,bottom-27,z-13]);
    b('lower-sill','body',[-x,bottom-27,-z],[x,bottom,z]);
    b('rear-insulated-panel','body',[-x,bottom,-z],[x,innerTop,-z+back-6]);
    b('rear-cavity-liner','liner',[-x+side,bottom,-z+back-6],[x-side,innerTop,openingBack]);
    b('header-canopy','body',[-x,innerTop,-z],[x,h,z]);
    for (const sx of [-1,1] as const) {
      const x0=sx===-1?-x:x-side;
      const x1=x0+side;
      const edgeFront=upright?z:z-22;
      b(`side-insulation-${sx}`,'body',[x0,bottom,-z],[x1,innerTop,edgeFront]);
      const ledX=sx===-1?-x+side:x-side-10;
      if(upright) b(`side-cavity-led-${sx}`,'light',[ledX,bottom+27,z-89],[ledX+10,innerTop-24,z-83]);
    }
    vent('front-return-grille',Math.round(bottom*.43),-x+78,x-78,z-9);
    if (!upright) {
      b('top-discharge-nozzle','trim',[-x+side,innerTop-24,z-73],[x-side,innerTop,z-36]);
      b('canopy-cavity-led','light',[-x+side+20,innerTop-11,z-104],[x-side-20,innerTop,z-94]);
      b('floor-air-return','metal',[-x+side,bottom,z-45],[x-side,bottom+6,z-15]);
      if(detail==='high') for(let i=0;i<5;i++){
        b(`return-channel-${i}`,'trim',[-x+side+10,bottom+6,z-42+i*5],[x-side-10,bottom+8,z-41+i*5]);
      }
    }
    if (upright) {
      b('door-center-mullion','trim',[-14,bottom,z-37],[14,innerTop,z-23]);
      const doors=[[-x+side,-6],[6,x-side]] as const;
      for(const [i,[a,c]] of doors.entries()){
        const fz=z-20,r=18;
        b(`door-glass-${i}`,'glass',[a+r,bottom+r,fz-8],[c-r,innerTop-r,fz-1]);
        b(`door-vertical-left-${i}`,'metal',[a,bottom,fz-12],[a+r,innerTop,fz+5]);
        b(`door-vertical-right-${i}`,'metal',[c-r,bottom,fz-12],[c,innerTop,fz+5]);
        b(`door-horizontal-lower-${i}`,'metal',[a+r,bottom,fz-12],[c-r,bottom+r,fz+5]);
        b(`door-horizontal-upper-${i}`,'metal',[a+r,innerTop-r,fz-12],[c-r,innerTop,fz+5]);
        const px=i===0?c-39:a+39, py=Math.round((innerTop+bottom)*.52);
        b(`door-pull-${i}`,'trim',[px-6,py-110,z-7],[px+6,py+110,z]);
        for(const sy of [-1,1]){
          b(`door-pull-anchor-${i}-${sy}`,'trim',[px-6,py+sy*96-6,fz-2],[px+6,py+sy*96+6,z]);
          const hinge=i===0?a-1:c-10, hy=sy===-1?bottom+58:innerTop-78;
          b(`door-hinge-${i}-${sy}`,'trim',[hinge,hy,z-25],[hinge+11,hy+18,z-9]);
        }
      }
    }
    const bedTop=bottom+18;
    const tierY=[bedTop,...[1,2,3,4].map(i=>Math.round(bedTop+(innerTop-bedTop)*i/5))];
    for (const [level,y] of tierY.entries()){
      const a=-x+side, c=x-side;
      const shelfBack=openingBack+5;
      // Wind-curtain upper decks project 500 mm on the reference envelope;
      // keep the base deeper but retain the clear return path at the face.
      const shelfFront=level===0 ? face-45 : upright ? face-33 : Math.min(shelfBack+500,face-68);
      b(`deck-${level}`,'liner',[a,y-15,shelfBack],[c,y,shelfFront]);
      b(`price-rail-${level}`,'rail',[a,y-13,shelfFront-10],[c,y+7,shelfFront]);
      for(const sx of [-1,1]){
        const bracket0=sx===-1?a+6:c-15;
        if(level>0) b(`side-bracket-${level}-${sx}`,'metal',[bracket0,y-44,shelfBack],[bracket0+9,y-14,shelfFront-45]);
      }
      const ceiling=tierY[level+1] ?? innerTop;
      const upper=ceiling-30;
      for(const bay of [0,1]){
        mount(`deck-${level}`,level,bay,y,bay===0?a+23:14,bay===0?-14:c-23,shelfBack+12,shelfFront-19,upper);
      }
    }
  }
  return {kind,detail,dimensionsMm,parts,mounts};
}
