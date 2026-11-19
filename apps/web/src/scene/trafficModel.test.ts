import {expect,it} from 'vitest';
import {trafficPose} from './trafficModel';
it('keeps 16 circulating cars exterior-only and separated within each lane',()=>{
 for(const [w,d] of [[80,50],[130,100]])for(let t=0;t<100;t+=.5)for(const lane of [0,1] as const){
  const poses=Array.from({length:8},(_,i)=>trafficPose(w!,d!,t,i,lane));
  for(const p of poses){expect(Math.abs(p.x)>w!/2||Math.abs(p.z)>d!/2).toBe(true); expect(Number.isFinite(p.yaw)).toBe(true);}
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)expect(Math.hypot(poses[i]!.x-poses[j]!.x,poses[i]!.z-poses[j]!.z)).toBeGreaterThan(8);
 }
});
it('is deterministic and rejects invalid input',()=>{expect(trafficPose(80,50,10,2,0)).toEqual(trafficPose(80,50,10,2,0));expect(()=>trafficPose(80,50,-1,0,0)).toThrow();});
