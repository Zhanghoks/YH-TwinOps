import type { DetailFixtureShape, DetailMaterial, DetailPart } from './detailGeometry';
export type SpecialComponent = 'service' | 'gate' | 'selfcheckout' | 'cart' | 'coldDoor' | 'dock';
/** Design-only board assets: no operational entities, real brands or extra Canvas. */
export function buildSpecialComponent(f: DetailFixtureShape, kind: SpecialComponent): DetailPart[] {
  const parts: DetailPart[]=[];
  const add=(id:string,p:[number,number,number],s:[number,number,number],color:string,material:DetailMaterial='metal',primitive:DetailPart['primitive']='box') => {
    parts.push({id,position:[p[0]*f.widthM,p[1]*f.heightM,p[2]*f.depthM],size:[s[0]*f.widthM,s[1]*f.heightM,s[2]*f.depthM],color,material,primitive});
  };
  const steel='#c3c8c2', dark='#35423e', green='#185d47', cream='#e4dfcf';
  if(kind==='service') {
    add('service-front',[0,.38,.36],[.98,.69,.22],green);
    add('service-top',[0,.75,0],[1,.06,1],cream);
    for(const x of [-.46,.46]) add(`service-side-${x}`,[x,.38,0],[.07,.69,.84],cream);
    for(let i=0;i<30;i++) add(`service-flute-${i}`,[(i/29-.5)*.94,.38,.478],[.009,.65,.018],'#307660');
    add('service-plinth',[0,.04,.32],[.94,.08,.3],dark);
    for(const x of [-.25,.25]) {
      add(`service-terminal-stand-${x}`,[x,.82,0],[.025,.12,.045],dark);
      add(`service-terminal-${x}`,[x,.92,0],[.09,.16,.035],dark);
      add(`service-display-${x}`,[x,.92,.02],[.075,.12,.008],'#7caaa1','label');
    }
  } else if(kind==='gate') {
    for(const side of [-1,1]) {
      add(`gate-pedestal-${side}`,[side*.39,.47,0],[.18,.94,.83],steel);
      add(`gate-indicator-${side}`,[side*.39,.96,0],[.13,.04,.5],green,'label');
      add(`gate-wing-${side}`,[side*.15,.48,.04],[.28,.61,.03],'#a7d8ca','glass');
      add(`gate-hinge-${side}`,[side*.30,.48,.04],[.025,.65,.04],dark);
    }
  } else if(kind==='selfcheckout') {
    add('self-base',[0,.035,0],[.9,.07,.9],dark);
    add('self-pedestal',[0,.29,0],[.6,.5,.68],cream);
    add('self-scanner-shelf',[0,.55,.04],[.92,.055,.88],steel);
    add('self-scanner',[0,.585,.17],[.36,.018,.32],'#263a38','glass');
    add('self-neck',[0,.72,-.29],[.18,.31,.08],dark);
    add('self-screen-frame',[0,.86,-.23],[.56,.28,.09],dark);
    add('self-screen',[0,.86,-.177],[.47,.22,.012],'#79aaa3','label');
    add('self-payment',[.32,.63,.03],[.18,.12,.22],dark);
    add('self-receipt',[0,.39,.35],[.20,.025,.012],dark);
  } else if(kind==='coldDoor') {
    add('cold-door-seal',[0,.48,0],[.95,.95,.85],dark);
    add('cold-door-slab',[0,.48,.05],[.86,.90,.8],cream);
    for(const x of [-.48,.48]) add(`cold-door-jamb-${x}`,[x,.5,0],[.04,1,1],steel);
    add('cold-door-track',[0,.975,0],[.96,.05,1],steel);
    add('cold-door-handle',[.29,.50,.475],[.035,.22,.05],dark);
    add('cold-door-label',[0,.69,.46],[.19,.08,.015],green,'label');
  } else if(kind==='dock') {
    add('dock-platform',[0,.07,.10],[1,.14,.8],dark);
    add('dock-door',[0,.55,-.32],[.76,.79,.08],steel);
    for(let i=0;i<14;i++) add(`dock-slat-${i}`,[0,.18+i*.054,-.27],[.74,.009,.016],'#8c9690');
    for(const side of [-1,1]) {
      add(`dock-seal-${side}`,[side*.43,.56,-.30],[.12,.88,.18],dark);
      add(`dock-bollard-${side}`,[side*.43,.24,.25],[.05,.22,.06],'#d8ad3e');
      add(`dock-bollard-stripe-${side}`,[side*.43,.27,.285],[.052,.035,.008],dark);
    }
    add('dock-header',[0,.96,-.30],[.98,.08,.18],dark);
    add('dock-leveler',[0,.15,.15],[.56,.025,.60],'#606c66');
  } else {
    // Four nested illustrative carts, not the reference board's operational cart count.
    for(let i=0;i<4;i++) {
      const x=-.27+i*.17;
      add(`cart-${i}-floor`,[x,.45,0],[.28,.025,.65],steel);
      add(`cart-${i}-front-rim`,[x-.15,.85,0],[.018,.022,.70],steel);
      for(const side of [-1,1]) {
        add(`cart-${i}-rim-${side}`,[x,.85,side*.34],[.31,.022,.022],steel);
        for(let wire=0;wire<7;wire++) add(`cart-${i}-wire-${side}-${wire}`,[x+(wire/6-.5)*.29,.66,side*.34],[.006,.38,.012],steel);
        add(`cart-${i}-chassis-${side}`,[x,.19,side*.28],[.28,.035,.035],steel);
        add(`cart-${i}-midrail-${side}`,[x,.65,side*.34],[.31,.012,.015],steel);
        for(const end of [-1,1]) add(`cart-${i}-caster-${side}-${end}`,[x+end*.11,.17,side*.28],[.02,.08,.025],steel);
        add(`cart-${i}-frame-${side}`,[x,.28,side*.28],[.025,.32,.025],steel);
        for(const end of [-1,1]) add(`cart-${i}-wheel-${side}-${end}`,[x+end*.11,.10,side*.28],[.045,.13,.10],dark,'rubber','sphere');
      }
      for(let wire=0;wire<7;wire++) add(`cart-${i}-front-${wire}`,[x-.15,.66,(wire/6-.5)*.66],[.012,.38,.012],steel);
      add(`cart-${i}-handle`,[x+.16,.93,0],[.025,.04,.76],green);
    }
  }
  return parts;
}
