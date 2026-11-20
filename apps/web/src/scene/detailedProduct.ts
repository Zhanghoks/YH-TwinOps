/** Original unbranded product silhouettes. Coordinates use a unit envelope, not shelf dimensions. */
export const DETAILED_PRODUCT_KINDS = ['snack-pouch','can','jar','carton','capped-bottle','handled-detergent','pump-bottle','tissue-pack','apple','citrus','leafy-greens','frozen-pouch','frozen-box','milk-carton','yogurt-cup','meat-tray'] as const
export type DetailedProductKind = typeof DETAILED_PRODUCT_KINDS[number]
export interface DetailedProductOptions { kind: DetailedProductKind; size: readonly [number,number,number]; color: string | number; lod?: 'near'|'far' }
export interface ProductPart { id: string; shape: 'box'|'ellipsoid'|'cylinder'|'roof'|'pouch'; position: [number,number,number]; size: [number,number,number]; color: string|number; topRatio?: number }
export interface DetailedProductModel { kind: DetailedProductKind; size: readonly [number,number,number]; lod: 'near'|'far'; parts: ProductPart[] }
export function buildDetailedProduct(options: DetailedProductOptions): DetailedProductModel {
  const {kind,size,color,lod='near'}=options
  if (!DETAILED_PRODUCT_KINDS.includes(kind)) throw new Error('Unsupported product silhouette')
  if(size.some(v=>!Number.isFinite(v)||v<=0)) throw new Error('Product size must contain three positive finite metres')
  const parts:ProductPart[]=[]; const near=lod==='near'; const white='#f4f0df', dark='#35443c', green='#49793c'
  const add=(id:string,shape:ProductPart['shape'],x:number,y:number,z:number,w:number,h:number,d:number,c:string|number=color,topRatio?:number)=>parts.push({id,shape,position:[x*size[0],y*size[1],z*size[2]],size:[w*size[0],h*size[1],d*size[2]],color:c,topRatio})
  const label=(x=0,y=.48,w=.7,h=.32,z=.49)=>{if(near){add('paper-label','box',x,y,z,w,h,.012,white);add('label-mark','box',x,y+.06,z+.008,w*.57,h*.14,.004,dark)}}
  switch(kind){
    case 'snack-pouch': case 'frozen-pouch':
      add('sealed-bag','pouch',0,.5,0,1,1,.94); if(near){add('top-crimp','box',0,.97,0,.74,.06,.22);add('bottom-crimp','box',0,.025,0,.8,.05,.3);label(0,.49,.56,.29,.473)} break
    case 'can': case 'jar':
      add('round-body','cylinder',0,.46,0,.92,.92,.92); add('lid','cylinder',0,.96,0,1,.08,1,kind==='can'?'#bbc4c1':dark)
      if(near){add('bottom-rim','cylinder',0,.025,0,.96,.05,.96,'#abb6b1');label(0,.47,.48,.34,.455); if(kind==='can') add('pull-tab','box',0,.997,0,.18,.006,.3,dark)} break
    case 'carton': case 'frozen-box':
      add('folded-box','box',0,.5,0,1,1,.96);label(0,.53,.72,.55,.483);if(near)add('top-fold','box',0,.996,0,.9,.008,.05,white);break
    case 'milk-carton':
      add('carton-body','box',0,.37,0,1,.74,.96); add('gable-top','roof',0,.855,0,1,.23,.96); add('fold-seam','box',0,.985,0,1,.03,.055,white);label(0,.39,.7,.43,.483); break
    case 'capped-bottle': case 'pump-bottle':
      add('bottle-body','cylinder',0,.32,0,1,.64,1);add('shoulder','cylinder',0,.71,0,1,.14,1,color,.47);add('neck','cylinder',0,.835,0,.36,.11,.36)
      if(kind==='capped-bottle')add('screw-cap','cylinder',0,.945,0,.49,.11,.49,dark)
      else {add('pump-stem','cylinder',0,.91,0,.17,.12,.17,dark);add('pump-head','box',.12,.975,0,.66,.05,.2,dark)}
      label(0,.35,.52,.32,.49);break
    case 'handled-detergent':
      add('detergent-body','box',-.16,.3,0,.68,.6,.94);add('sloped-shoulder','cylinder',-.16,.68,0,.68,.16,.94,color,.73);add('cap','cylinder',-.16,.88,0,.36,.24,.54,dark)
      // Open handle: two separated pillars and bridge, no solid plate behind the hole.
      add('handle-inner-post','box',.16,.69,0,.1,.36,.25);add('handle-outer-post','box',.45,.69,0,.1,.36,.25);add('handle-top-bridge','box',.305,.88,0,.39,.1,.25);add('handle-bottom-bridge','box',.305,.5,0,.39,.1,.25)
      label(-.16,.31,.48,.3,.473);break
    case 'tissue-pack':
      add('soft-pack','pouch',0,.43,0,1,.86,1); if(near){add('opening','box',0,.864,0,.58,.008,.18,dark);add('tissue-sheet','box',0,.932,0,.4,.136,.06,white)}break
    case 'apple': case 'citrus':
      add('fruit','ellipsoid',0,.46,0,1,.92,1); if(near){add('stem','cylinder',0,.955,0,.055,.09,.055,'#725233');if(kind==='apple')add('leaf','ellipsoid',.14,.965,0,.24,.055,.14,green)}break
    case 'leafy-greens':
      add('cut-stems','cylinder',0,.15,0,.28,.3,.35,'#b1c983');add('leaf-heart','ellipsoid',0,.51,0,.68,.72,.7,green)
      if(near) for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(`leaf-${i}`,'ellipsoid',Math.cos(a)*.24,.64+(i%2)*.05,Math.sin(a)*.23,.48,.62,.48,i%2?'#65944a':'#3e6e38')}break
    case 'yogurt-cup':
      add('tapered-cup','cylinder',0,.46,0,.96,.92,.96,color,1.3);add('foil-lid','cylinder',0,.96,0,1,.08,1,white);label(0,.49,.42,.3,.463);break
    case 'meat-tray':
      add('tray-base','box',0,.065,0,1,.13,1,white); for(const x of [-.475,.475]) add(`rim-x-${x}`,'box',x,.2,0,.05,.27,1,white)
      for(const z of [-.475,.475])add(`rim-z-${z}`,'box',0,.2,z,.9,.27,.05,white)
      add('meat-cut','ellipsoid',0,.55,0,.83,.84,.8);if(near)for(const x of [-.18,.1])add(`fat-${x}`,'box',x,.9,0,.04,.025,.45,'#eec5b0');break
  }
  return {kind,size:[...size],lod,parts}
}
