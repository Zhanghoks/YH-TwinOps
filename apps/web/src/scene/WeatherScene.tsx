import { VolumetricClouds,type CloudQuality } from './VolumetricClouds';
import { useEffect,useMemo,useRef } from 'react';
import { useFrame,useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildExteriorRain,WEATHER_PRESETS,type SimulatedWeather } from './weatherModel';
export function WeatherScene({weather,width,depth,center,reducedMotion,cloudQuality='low'}:{weather:SimulatedWeather;width:number;depth:number;center:readonly[number,number];reducedMotion:boolean;cloudQuality?:CloudQuality}) {
  const palette=WEATHER_PRESETS[weather];
  const invalidate=useThree(s=>s.invalidate);
  const positions=useMemo(()=>buildExteriorRain(width,depth),[width,depth]);
  const buffer=useRef<THREE.BufferAttribute>(null);
  const visible=useRef(true);
  const elapsed=useRef(0);
  const uniforms=useMemo(()=>({zenith:{value:new THREE.Color(palette.zenith)},horizon:{value:new THREE.Color(palette.horizon)},cloud:{value:palette.cloud}}),[palette]);
  useEffect(()=>{
    invalidate();
    if(weather!=='rain'||reducedMotion) return;
    let timer:ReturnType<typeof setInterval>|undefined;
    const update=()=>{
      if(timer) clearInterval(timer);
      visible.current=!document.hidden;
      if(visible.current) timer=setInterval(invalidate,1000/30);
    };
    update();document.addEventListener('visibilitychange',update);
    return ()=>{if(timer)clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[weather,reducedMotion,invalidate]);
  useFrame((_,delta)=>{
    if(weather!=='rain'||reducedMotion||!visible.current||!buffer.current)return;
    elapsed.current+=delta;
    if(elapsed.current<1/30)return;
    const step=Math.min(elapsed.current,.06);elapsed.current=0;
    for(let i=0;i<positions.length;i+=6) {
      const y=(positions[i+1]!-step*9+14)%14;
      positions[i+1]=y;positions[i+4]=y+1;
    }
    buffer.current.needsUpdate=true;
  });
  return <group position={[center[0],0,center[1]]}>
    <mesh renderOrder={-100}>
      <sphereGeometry args={[500,24,12]}/>
      <shaderMaterial side={THREE.BackSide} depthWrite={false} uniforms={uniforms}
        vertexShader={'varying vec3 dir; void main(){dir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}'}
        fragmentShader={'uniform vec3 zenith;uniform vec3 horizon;uniform float cloud;varying vec3 dir;void main(){float h=clamp(dir.y*.7+.3,0.,1.);float c=sin(dir.x*18.+dir.z*12.)*sin(dir.z*27.-dir.x*9.);vec3 col=mix(horizon,zenith,h);col=mix(col,horizon,smoothstep(-.2,.7,c)*cloud*.5);gl_FragColor=vec4(col,1.);}'} />
    </mesh>
    <VolumetricClouds weather={weather} quality={cloudQuality}/>
    {weather==='rain'&&<lineSegments frustumCulled={false}>
      <bufferGeometry><bufferAttribute ref={buffer} attach="attributes-position" args={[positions,3]}/></bufferGeometry>
      <lineBasicMaterial color="#9dbed0" transparent opacity={.65} depthWrite={false}/>
    </lineSegments>}
  </group>;
}
