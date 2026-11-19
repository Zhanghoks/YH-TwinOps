import {expect,it} from 'vitest';
import {buildCityContext} from './cityContext';
import {buildSceneCamera} from './sceneCamera';
it('keeps deterministic low-poly urban blocks outside the business floor',()=>{
 for(const [w,d] of [[80,50],[130,100]]) {
  const parts=buildCityContext(w!,d!);
  expect(parts).toEqual(buildCityContext(w!,d!));
  expect(parts.length).toBeLessThan(1500);
  expect(new Set(parts.map(p=>p.id)).size).toBe(parts.length);
  for(const p of parts)expect(Math.abs(p.position[0])-p.size[0]/2>=w!/2||Math.abs(p.position[2])-p.size[2]/2>=d!/2).toBe(true);
  expect(parts.filter(p=>p.id.endsWith('-body')).length).toBe(28);
 }
});
it('offers an upward horizon view and rejects invalid input',()=>{
 const c=buildSceneCamera('sky',[0,0],100,130);
 expect(c.target[1]).toBeGreaterThan(c.position[1]);
 expect(()=>buildCityContext(NaN,100)).toThrow();
});
it('closes all four city sides and exposes six furnished low-rise cutaways',()=>{
 const w=130,d=100,parts=buildCityContext(w,d);
 const south=parts.filter(p=>p.id.startsWith('city-south-interior-'));
 expect(south.length).toBeGreaterThan(200);
 expect(south.filter(p=>p.id.endsWith('-floor'))).toHaveLength(6);
 expect(south.filter(p=>p.id.includes('-roof'))).toHaveLength(0);
 expect(Math.max(...south.map(p=>p.position[1]+p.size[1]/2))).toBeLessThanOrEqual(3.61);
 for(const suffix of ['counter','table-top-0','seat-0-1','screen','rear-shelf','partition']) {
  expect(south.some(p=>p.id===`city-south-interior-0-${suffix}`)).toBe(true);
 }
 const road=parts.find(p=>p.id==='city-south-avenue')!;
 for(const side of [-1,1]) {
  const cross=parts.find(p=>p.id===`city-cross-road-${side}`)!;
  expect(road.position[2]-road.size[2]/2).toBeLessThan(cross.position[2]+cross.size[2]/2);
  expect(Math.abs(cross.position[0])+cross.size[0]/2).toBeLessThanOrEqual(road.size[0]/2);
 }
});
it('provides distant background massing in all four directions',()=>{
 const p=buildCityContext(130,100);
 for(const prefix of ['city-far-south-','city-far-side--1-','city-far-side-1-','city-skyline-'])expect(p.some(v=>v.id.startsWith(prefix))).toBe(true);
});
