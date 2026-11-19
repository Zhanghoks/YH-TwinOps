import {expect,it} from 'vitest';
import {detailPartsAtLod,detailTriangleBudget,nextDetailLod,fixtureDetailLod,isMicroDetail} from './detailLod';
import {buildFixtureDetail} from './detailGeometry';
import {layout} from '../data';
import {buildComponentSample,COMPONENT_SAMPLES} from './componentCatalog';
it('uses hysteresis and ignores invalid heights',()=>{
 expect(nextDetailLod('near',36)).toBe('far'); expect(nextDetailLod('near',34)).toBe('near');
 expect(nextDetailLod('far',30)).toBe('far'); expect(nextDetailLod('far',27)).toBe('near'); expect(nextDetailLod('far',NaN)).toBe('far');
});
it('keeps near geometry untouched and far geometry a non-mutating subset with all product bodies',()=>{
 for(const fixture of [...layout.fixtures,...COMPONENT_SAMPLES.map(s=>buildComponentSample(s.id))]) {
  const parts=buildFixtureDetail(fixture),before=structuredClone(parts),far=detailPartsAtLod(parts,'far');
  expect(detailPartsAtLod(parts,'near')).toBe(parts);expect(parts).toEqual(before);expect(far.length).toBeGreaterThan(0);
  for(const p of far)expect(parts).toContain(p);
  for(const p of parts.filter(p=>p.material==='product'||p.material==='produceBed'||p.material==='wood'||p.material==='glass').filter(p=>!isMicroDetail(p)))expect(far).toContain(p);
 }
});
it('reduces full-store triangle budget substantially without removing fixtures',()=>{
 let near=0,far=0;
 for(const f of layout.fixtures){const p=buildFixtureDetail(f);near+=detailTriangleBudget(p,'near');far+=detailTriangleBudget(p,'far');}
 expect(far).toBeLessThan(near*.7);
});

it('uses per-fixture distance at low skyline altitude, keeps nearby and selected geometry full',()=>{
 const f=buildComponentSample('fruit');f.fixtureId='business-fruit';f.x=0;f.z=0;
 expect(fixtureDetailLod('near',[0,22,100],f)).toBe('far');
 expect(fixtureDetailLod('far',[0,22,20],f)).toBe('near');
 expect(fixtureDetailLod('far',[0,22,50],f)).toBe('far');
 expect(fixtureDetailLod('near',[0,22,50],f)).toBe('near');
 expect(fixtureDetailLod('far',[0,200,200],f,true)).toBe('near');
 expect(fixtureDetailLod('far',[0,200,200],buildComponentSample('fruit'))).toBe('near');
});
it('removes only auxiliary named product details, not their primary bodies',()=>{
 for(const id of ['beverage','dairy','bakery','vegetable'] as const){
  const p=buildFixtureDetail(buildComponentSample(id)),far=detailPartsAtLod(p,'far');
  expect(p.some(isMicroDetail)).toBe(true);expect(far.some(isMicroDetail)).toBe(false);
  expect(far.some(p=>p.material==='product')).toBe(true);
 }
});
it('bounds candidate whole-store LOD budget',async()=>{
 const {generatePlanningLayout,buildReferenceDisplayFixtures}=await import('./planningLayout');
 const candidate=generatePlanningLayout(layout).layout;
 let visibleBudget=0;
 const totals:Record<string,{parts:number;oldFar:number;far:number;near:number;micro:number}>={};
 for(const fixture of [...candidate.fixtures,...buildReferenceDisplayFixtures(candidate)]){
  const p=buildFixtureDetail(fixture),t=totals[fixture.fixtureType]??={parts:0,oldFar:0,far:0,near:0,micro:0};
  const farParts=buildFixtureDetail(fixture,{lod:'far'});
  visibleBudget+=detailPartsAtLod(farParts,'far').reduce((sum,part)=>sum+(part.primitive==='sphere'?8:part.material==='glass'?12:6),0);
  t.parts+=p.length;t.near+=detailTriangleBudget(p,'near');t.far+=detailTriangleBudget(farParts,'far');t.micro+=p.filter(isMicroDetail).length;
  t.oldFar+=p.filter(part=>part.material==='label'?Math.max(...part.size)>=.32:part.material==='metal'||part.material==='rubber'?Math.max(...part.size)>=.12:true).reduce((s,p)=>s+(p.primitive==='box'?12:8),0);
 }
 expect(visibleBudget).toBeLessThan(150000);
 expect(Object.values(totals).reduce((s,t)=>s+t.far,0)).toBeLessThan(230000);
 expect(Object.values(totals).reduce((s,t)=>s+t.far,0)).toBeLessThan(Object.values(totals).reduce((s,t)=>s+t.oldFar,0));
});
it('selects camera-facing box sides in fixture-local space and preserves cube bounds',async()=>{
 const {distantBoxSides,visibleBoxFaceIndices}=await import('./detailLod');
 const THREE=await import('three');
 const f=buildComponentSample('fruit');f.x=0;f.y=0;f.z=0;f.rotationY=0;
 expect(distantBoxSides([100,50,100],f)).toBe('pp');expect(distantBoxSides([-100,50,100],f)).toBe('np');
 f.rotationY=Math.PI/2;expect(distantBoxSides([100,50,100],f)).toBe('np');
 expect(distantBoxSides([100,1,100],f)).toBeUndefined();
 f.rotationY=0;expect(distantBoxSides([0,50,100],f)).toBeUndefined();
 for(const sides of ['pp','pn','np','nn'] as const){
  const g=new THREE.BoxGeometry(1,1,1),original=g.index!;
  g.setIndex(visibleBoxFaceIndices(sides).flatMap(face=>Array.from({length:6},(_,i)=>original.getX(face*6+i))));
  expect(g.index!.count).toBe(18);g.computeBoundingBox();
  expect(g.boundingBox!.min.toArray()).toEqual([-.5,-.5,-.5]);expect(g.boundingBox!.max.toArray()).toEqual([.5,.5,.5]);
  const n=g.getAttribute('normal');for(let i=0;i<g.index!.count;i++){const j=g.index!.getX(i);expect(n.getY(j)).toBeGreaterThanOrEqual(0);expect(n.getX(j)*(sides[0]==='p'?1:-1)).toBeGreaterThanOrEqual(0);expect(n.getZ(j)*(sides[1]==='p'?1:-1)).toBeGreaterThanOrEqual(0);}
  g.dispose();
 }
});

it('limits individually modeled shelf merchandise to close aisle views, preserving inspector and selected detail',()=>{
 const f={...buildComponentSample('grocery'),fixtureId:'business-grocery'};
 expect(fixtureDetailLod('near',[0,1,14],f)).toBe('far');
 expect(fixtureDetailLod('far',[0,1,8],f)).toBe('near');
 expect(fixtureDetailLod('far',[0,1,11],f)).toBe('far');
 expect(fixtureDetailLod('near',[0,1,11],f)).toBe('near');
 expect(fixtureDetailLod('far',[0,100,100],f,true)).toBe('near');
 expect(fixtureDetailLod('far',[0,100,100],buildComponentSample('grocery'))).toBe('near');
});
