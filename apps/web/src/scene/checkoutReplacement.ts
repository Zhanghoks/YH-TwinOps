import { buildFixtureDetail, type DetailFixtureShape, type DetailPart } from './detailGeometry';

type V=[number,number,number];
export interface CheckoutActionSpace {
  id:'unload'|'scan'|'pay'|'bag';
  role:'customer'|'staff';
  /** X/Z orientation is an explicit model convention, not a staff-route change. */
  stand:[number,number];
  contact:V;
  reachM:number;
  workPartId:string;
  /** Length × height × depth of clear hand-space, anchored upward from contact. */
  handSpaceM:V;
}
export interface CheckoutReplacementModel {
  fixtureId:'F120';
  lod:'near'|'far';
  stocked:boolean;
  envelopeM:V;
  replacementEnvelopeM:V;
  parts:readonly DetailPart[];
  actions:readonly CheckoutActionSpace[];
  sourceItemCount:number;
  /** Explicit geometry convention: local -Z infeed, +Z bagging, +X customer. */
  itemFlow:readonly ['-Z','+Z'];
  customerSide:'+X'|'-X';
  staffSide:'-X'|'+X';
}

const eq=(a:number,b:number)=>Math.abs(a-b)<1e-6;
export function isDenseCheckoutReplacement(f:DetailFixtureShape):boolean {
  return f.fixtureId==='F120'&&f.fixtureType==='CHECKOUT'&&f.zoneId==='zone-checkout_n'&&f.designVariant===undefined&&
    eq(f.x,-1.25)&&eq(f.y,0)&&eq(f.z,39.75)&&eq(f.rotationY,0)&&eq(f.widthM,1.5)&&eq(f.depthM,5.5)&&eq(f.heightM,1.05);
}

/** F120-only 1.5×5.5 custom long lane. Mirroring is preview-only; runtime uses its original hand. */
export function buildCheckoutReplacement(f:DetailFixtureShape,
  {stocked=true,lod='near',mirror=false}:{stocked?:boolean;lod?:'near'|'far';mirror?:boolean}={},
):CheckoutReplacementModel|null {
  if(!isDenseCheckoutReplacement(f))return null;
  const yTop=.76;
  const parts:DetailPart[]=[];
  const dir=mirror?-1:1;
  const color={panel:'#58665f',rail:'#c6d1d0',trim:'#30393b',belt:'#273132',screen:'#6eada7',scanner:'#37555a',label:'#e6ede6'};
  const b=(id:string,mat:DetailPart['material'],color:string,min:V,max:V):void=>{
    parts.push({id,primitive:'box',material:mat,color,
      position:[dir*(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2],
      size:[max[0]-min[0],max[1]-min[1],max[2]-min[2]]});
  };
  // Intentionally not a rigidly rotated sample: these are three separate,
  // narrow body pods, left operator knee opening and right checkout fascia.
  b('infeed-pod','metal',color.panel,[-.38,.07,-2.62],[.63,.675,.53]);
  b('scanner-pod','metal',color.panel,[-.24,.07,.54],[.61,.685,1.31]);
  b('bagging-pod','metal',color.panel,[-.26,.07,1.39],[.57,.68,2.59]);
  for(const [i,z] of [-2.61,-.46,1.13,2.59].entries()){
    b(`aisle-foot-${i}`,'rubber',color.trim,[-.30,0,z-.08],[.43,.07,z+.08]);
  }
  b('belt-skirt-frame','metal',color.rail,[-.66,.675,-2.75],[.68,.742,.58]);
  b('belt','rubber',color.belt,[-.55,.742,-2.62],[.55,yTop,.52]);
  b('belt-edge-staff','metal',color.rail,[-.65,.742,-2.72],[-.56,.786,.57]);
  b('belt-edge-customer','metal',color.rail,[.56,.742,-2.72],[.75,.786,.57]);
  b('infeed-end-cover','metal',color.rail,[-.56,.742,-2.75],[.56,yTop,-2.62]);
  b('belt-to-scanner-bridge','metal',color.rail,[-.56,.742,.52],[.56,yTop,.62]);
  b('scanner-station','metal',color.rail,[-.75,.685,.58],[.65,.746,1.32]);
  b('scanner','label',color.scanner,[-.56,.746,.63],[.27,yTop,1.11]);
  b('scanner-side-deck','metal',color.rail,[.27,.746,.63],[.65,yTop,1.11]);
  b('scanner-staff-edge','metal',color.rail,[-.75,.746,.58],[-.56,yTop,1.13]);
  b('bridge-to-bagging','metal',color.rail,[-.56,.726,1.11],[.51,yTop,1.42]);
  b('bagging-frame','metal',color.rail,[-.64,.68,1.32],[.69,.742,2.75]);
  b('bagging-tray','metal',color.trim,[-.47,.742,1.42],[.55,yTop,2.61]);
  b('bagging-edge-staff','metal',color.rail,[-.60,.742,1.42],[-.49,.81,2.66]);
  b('bagging-edge-customer','metal',color.rail,[.56,.742,1.42],[.69,.81,2.66]);
  b('bagging-edge-end','metal',color.rail,[-.60,.742,2.63],[.69,.81,2.75]);
  // Face the employee -X; the small shopper terminal sits on the opposite edge.
  b('pos-stem','metal',color.trim,[-.57,yTop,.68],[-.49,.95,.78]);
  b('pos-screen-frame','metal',color.trim,[-.65,.887,.56],[-.56,1.05,.92]);
  b('pos-screen','label',color.screen,[-.655,.906,.579],[-.65,1.033,.901]);
  b('receipt-printer','metal',color.trim,[-.64,yTop,1.135],[-.42,.84,1.30]);
  b('customer-payment-pedestal','metal',color.trim,[.49,yTop,1.15],[.59,.86,1.28]);
  b('customer-payment-body','metal',color.trim,[.40,.844,1.10],[.69,.903,1.31]);
  b('customer-payment-screen','label',color.screen,[.50,.903,1.12],[.67,.907,1.254]);
  if(lod==='near'){
    b('payment-nfc-cue','label',color.label,[.61,.907,1.257],[.65,.91,1.28]);
    b('receipt-paper','label',color.label,[-.57,.84,1.20],[-.46,.852,1.226]);
    for(let i=0;i<4;i++)b('staff-pod-louvre-'+i,'rubber',color.trim,
      [-.384,.18+i*.018,-1.22],[-.38,.185+i*.018,-.74]);
  }
  const source=buildFixtureDetail(f).filter(p=>p.id==='belt-item-a'||p.id==='belt-item-b');
  if(stocked)for(const item of source){
    parts.push({...item,position:[dir*item.position[0],yTop+item.size[1]/2,item.position[2]]});
  }
  const action=(id:CheckoutActionSpace['id'],role:CheckoutActionSpace['role'],contact:V,workPartId:string,handSpaceM:V):CheckoutActionSpace=>{
    const stanceX=role==='customer'?1.16:-1.16;
    return {id,role,stand:[stanceX*dir,contact[2]],contact:[contact[0]*dir,contact[1],contact[2]],
      reachM:Math.abs(stanceX-contact[0]),workPartId,handSpaceM};
  };
  const actions=[
    action('unload','customer',[.49,yTop,-2.28],'belt',[.10,.19,.25]),
    action('scan','staff',[-.49,yTop,.91],'scanner',[.12,.14,.23]),
    action('pay','customer',[.60,.907,1.18],'customer-payment-screen',[.11,.11,.10]),
    action('bag','customer',[.48,yTop,1.93],'bagging-tray',[.12,.24,.68]),
  ] as const;
  const envelopeM:V=[1.5,1.05,5.5];
  return {fixtureId:'F120',lod,stocked,envelopeM,replacementEnvelopeM:envelopeM,parts,actions,sourceItemCount:source.length,
    itemFlow:['-Z','+Z'],customerSide:mirror?'-X':'+X',staffSide:mirror?'+X':'-X'};
}
