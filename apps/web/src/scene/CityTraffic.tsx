import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {trafficPose} from './trafficModel';
export function CityTraffic({width,depth,center,paused,onMetrics}:{width:number;depth:number;center:readonly[number,number];paused:boolean;onMetrics:(value:string)=>void}) {
 const bodies=useRef<THREE.InstancedMesh>(null),cabins=useRef<THREE.InstancedMesh>(null),wheels=useRef<THREE.InstancedMesh>(null),time=useRef(0),stats=useRef({frames:0,start:0});
 const invalidate=useThree(s=>s.invalidate);
 const object=useMemo(()=>new THREE.Object3D(),[]);
 const updateCars=(t:number)=>{
  for(let i=0;i<16;i++) {
   const p=trafficPose(width,depth,t,i%8,i<8?0:1);
   object.position.set(p.x,.65,p.z);object.rotation.set(0,p.yaw,0);object.updateMatrix();bodies.current?.setMatrixAt(i,object.matrix);
   object.position.set(p.x-Math.sin(p.yaw)*.15,1.25,p.z-Math.cos(p.yaw)*.15);object.updateMatrix();cabins.current?.setMatrixAt(i,object.matrix);
   for(let j=0;j<4;j++) {const x=j<2?-.77:.77,z=j%2===0?-1.15:1.15;object.position.set(p.x+x*Math.cos(p.yaw)+z*Math.sin(p.yaw),.3,p.z-x*Math.sin(p.yaw)+z*Math.cos(p.yaw));object.rotation.set(0,p.yaw,Math.PI/2);object.updateMatrix();wheels.current?.setMatrixAt(i*4+j,object.matrix);}
  }
  for(const mesh of [bodies.current,cabins.current,wheels.current])if(mesh)mesh.instanceMatrix.needsUpdate=true;
 };
 useEffect(()=>{updateCars(0);invalidate();},[width,depth]);
 useEffect(()=>{if(paused)return;let timer:ReturnType<typeof setInterval>|undefined;const refresh=()=>{if(timer)clearInterval(timer);stats.current={frames:0,start:performance.now()};if(!document.hidden)timer=setInterval(invalidate,1000/30);};refresh();document.addEventListener('visibilitychange',refresh);return()=>{if(timer)clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[paused,invalidate]);
 useFrame((state,delta)=>{
  if(paused||document.hidden)return;
  time.current+=Math.min(delta,.1);
  updateCars(time.current);
  const now=performance.now();stats.current.frames++;
  if(now-stats.current.start>=2000){const fps=stats.current.frames*1000/(now-stats.current.start);onMetrics(`${fps.toFixed(1)} 帧/秒 · ${state.gl.info.render.calls} 绘制 · ${(state.gl.info.render.triangles/1000).toFixed(0)}k 三角面`);stats.current={frames:0,start:now};}
 });
 return <><group position={[center[0],0,center[1]]}>
 <instancedMesh ref={bodies} args={[undefined,undefined,16]} frustumCulled={false}><boxGeometry args={[1.55,.7,3.8]}/><meshStandardMaterial color="#9faca9"/></instancedMesh>
 <instancedMesh ref={cabins} args={[undefined,undefined,16]} frustumCulled={false}><boxGeometry args={[1.4,.6,1.9]}/><meshStandardMaterial color="#526f7c"/></instancedMesh>
 <instancedMesh ref={wheels} args={[undefined,undefined,64]} frustumCulled={false}><cylinderGeometry args={[.29,.29,.16,8]}/><meshStandardMaterial color="#354143"/></instancedMesh>
 </group></>;
}
