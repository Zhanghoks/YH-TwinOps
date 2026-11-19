import {expect,it} from 'vitest';
import {buildUrbanFabric} from './urbanFabric';
it('builds deterministic bounded continuous urban fabric outside the business floor',()=>{
 for(const [w,d] of [[80,50],[130,100],[300,200]]) {
  const parts=buildUrbanFabric(w!,d!);
  expect(parts).toEqual(buildUrbanFabric(w!,d!));
  expect(parts.length).toBeLessThan(1800);
  expect(new Set(parts.map(p=>p.id)).size).toBe(parts.length);
  for(const p of parts) {
   expect(Math.abs(p.position[0])-p.size[0]/2>=w!/2||Math.abs(p.position[2])-p.size[2]/2>=d!/2).toBe(true);
   p.size.forEach(n=>expect(n).toBeGreaterThan(0));
  }
 }
});
it('provides connected roads, podium street walls and courtyards on all four sides',()=>{
 const parts=buildUrbanFabric(130,100);
 for(const suffix of ['podium','courtyard','streetwall-a','streetwall-b','corner'])expect(parts.filter(p=>p.id.endsWith(suffix)).length).toBeGreaterThan(25);
 const podium=parts.filter(p=>p.id.endsWith('podium'));
 for(const side of [-1,1]) {
  expect(podium.some(p=>p.position[0]*side>200)).toBe(true);
  expect(podium.some(p=>p.position[2]*side>200)).toBe(true);
 }
 expect(parts.filter(p=>p.id.includes('connector-'))).toHaveLength(8);
 expect(parts.some(p=>p.id.startsWith('fabric-road-x-'))).toBe(true);
 expect(parts.some(p=>p.id.startsWith('fabric-road-z-'))).toBe(true);
 const south=parts.filter(p=>p.id.endsWith('corner')&&p.position[2]>200);
 expect(Math.max(...south.map(p=>p.position[1]+p.size[1]/2))).toBeLessThan(15);
});
it('rejects invalid dimensions',()=>{expect(()=>buildUrbanFabric(NaN,100)).toThrow();expect(()=>buildUrbanFabric(10,20)).toThrow();});
