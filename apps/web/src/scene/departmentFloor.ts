import type {ReferenceRegion} from './planningLayout';
/** Visual teaching zoning only, not paths, inventory or legal aisle markings. */
export function departmentFloorPanels(regions:readonly ReferenceRegion[]) {
 return regions.filter(r=>r.code!=='BACK').map(r=>({id:r.code,x:(r.bounds.x0+r.bounds.x1)/2,z:(r.bounds.z0+r.bounds.z1)/2,width:r.bounds.x1-r.bounds.x0,depth:r.bounds.z1-r.bounds.z0,color:r.code==='F01'?'#9aaf8d':['F03','F04','F07','F08'].includes(r.code)?'#a9bfbd':['F05','F06'].includes(r.code)?'#c9b38c':r.code==='F12'?'#b3bcae':'#c7c0ae'})).filter(r=>r.width>0&&r.depth>0);
}
