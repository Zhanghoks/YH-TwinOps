import { expect,it } from 'vitest';
import { buildExteriorArchitecture } from './exteriorArchitecture';
import { buildEntranceSiteCamera, buildSceneCamera } from './sceneCamera';
it('builds deterministic bounded exterior-only site context without changing the interior',()=>{
  for(const [w,d] of [[80,50],[130,100],[300,200]]) {
    const p=buildExteriorArchitecture(w!,d!);
    expect(p).toEqual(buildExteriorArchitecture(w!,d!));
    expect(p.length).toBeLessThan(650);
    expect(new Set(p.map(p=>p.id)).size).toBe(p.length);
    for(const a of p) {
      a.size.forEach(n=>expect(n).toBeGreaterThan(0));
      expect(Math.abs(a.position[0])+a.size[0]/2).toBeLessThanOrEqual(w!/2+30);
      expect(Math.abs(a.position[2])+a.size[2]/2).toBeLessThanOrEqual(d!/2+24);
      // Every object footprint stays outside the store rectangle.
      expect(Math.abs(a.position[0])-a.size[0]/2>=w!/2 || Math.abs(a.position[2])-a.size[2]/2>=d!/2).toBe(true);
    }
  }
});
it('provides roads, parking, landscaping, entry canopy and crossing',()=>{
  const p=buildExteriorArchitecture(130,100,-22.5);
  for(const id of ['site-road-south','site-parking','entry-canopy','crossing-0','tree-east-0-crown','parked-car-0-body']) expect(p.some(p=>p.id===id)).toBe(true);
  expect(p.find(p=>p.id==='entry-canopy')?.position[0]).toBe(-22.5);
  expect(buildSceneCamera('site',[0,0],100,130).position[1]).toBeGreaterThan(buildSceneCamera('overview',[0,0],100,130).position[1]);
});
it('rejects invalid dimensions',()=>{
  expect(()=>buildExteriorArchitecture(0,100)).toThrow();
});

it('frames the actual western candidate entry and plaza',()=>{
  expect(buildEntranceSiteCamera([0,0],100,-22.5).target).toEqual([-22.5,1.5,53]);
});
