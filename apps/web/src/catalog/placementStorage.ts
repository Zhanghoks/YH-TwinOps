import { productPlacementSchema, type ProductPlacement } from '@yh/contracts';

export const PLACEMENT_STORAGE_KEY='yh-twinops:placement-overrides:v1';
type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;

export function loadPlacementOverride(storage?:StoragePort):{value?:ProductPlacement;error?:string} {
  try {
    const target=storage??localStorage;
    const raw=target.getItem(PLACEMENT_STORAGE_KEY);
    if(raw===null)return {};
    if(raw.length>2048)throw new Error('placement budget');
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).some(k=>k!=='version'&&k!=='placement')
      || !('version' in parsed)||parsed.version!==1||!('placement' in parsed))throw new Error('placement version');
    const value=productPlacementSchema.parse(parsed.placement);
    if(value.origin!=='USER_SANDBOX'||value.fixtureId!=='F077')throw new Error('placement scope');
    return {value};
  }catch{return {error:'本地陈列数据不兼容，已退回原版。'};}
}

export function savePlacementOverride(placement:ProductPlacement|undefined,storage?:StoragePort):boolean {
  try{
    const target=storage??localStorage;
    if(placement) {
      const value=productPlacementSchema.parse(placement);
      if(value.origin!=='USER_SANDBOX'||value.fixtureId!=='F077')return false;
      target.setItem(PLACEMENT_STORAGE_KEY,JSON.stringify({version:1,placement:value}));
    } else target.removeItem(PLACEMENT_STORAGE_KEY);
    return true;
  }catch{return false;}
}
