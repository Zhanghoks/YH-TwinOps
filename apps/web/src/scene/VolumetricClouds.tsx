import { useMemo,useRef } from 'react';
import * as THREE from 'three';
import type { SimulatedWeather } from './weatherModel';

export type CloudQuality = 'off' | 'low' | 'high';
export const CLOUD_STEPS = { off:0, low:24, high:48 } as const;

const vertexShader = `
varying vec3 sampleSurface;
void main() {
  sampleSurface = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const fragmentShader = `
precision highp float;
varying vec3 sampleSurface;
uniform vec3 cameraLocal;
uniform vec3 cloudTint;
uniform float thickness;
uniform float seed;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float noise3(vec3 p) {
  vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
  mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float density(vec3 p) {
  // Overlapping ellipsoids define a cumulus envelope, with true 3D noise erosion.
  float edge=min(length((p-vec3(-.34,-.12,0.0))/vec3(.59,.65,.8)),
                 min(length((p-vec3(.08,.14,.02))/vec3(.61,.77,.72)),
                     length((p-vec3(.43,-.14,-.08))/vec3(.48,.56,.68))));
  float envelope=1.0-smoothstep(.62,1.0,edge);
  vec3 q=p*3.5+vec3(seed);
  float n=noise3(q)*.65+noise3(q*2.1)*.25+noise3(q*4.3)*.10;
  return max(0.0,envelope*(n*.85+.35)-.18)*thickness;
}
void main() {
  vec3 ray=normalize(sampleSurface-cameraLocal);
  vec3 safeRay=sign(ray+vec3(.000001))*max(abs(ray),vec3(.000001));
  vec3 a=(-vec3(1.0)-cameraLocal)/safeRay;
  vec3 b=( vec3(1.0)-cameraLocal)/safeRay;
  vec3 nearV=min(a,b),farV=max(a,b);
  float start=max(max(nearV.x,nearV.y),max(nearV.z,0.0));
  float end=min(min(farV.x,farV.y),farV.z);
  if(end<=start)discard;
  float ds=(end-start)/float(STEPS);
  float transmittance=1.0;
  vec3 radiance=vec3(0.0);
  vec3 sunDir=normalize(vec3(.35,.9,.25));
  for(int i=0;i<STEPS;i++) {
    vec3 p=cameraLocal+ray*(start+(float(i)+.5)*ds);
    float rho=density(p);
    if(rho>.001) {
      float lightDepth=0.0;
      // Three directional light samples approximate single-scattering self-shadow.
      for(int j=1;j<=3;j++)lightDepth+=density(p+sunDir*(float(j)*.18))*.18;
      float light=exp(-lightDepth*3.0);
      float opacity=1.0-exp(-rho*ds*4.0);
      vec3 illumination=cloudTint*(.48+.52*light);
      radiance+=transmittance*opacity*illumination;
      transmittance*=1.0-opacity;
      if(transmittance<.015)break;
    }
  }
  float alpha=1.0-transmittance;
  if(alpha<.004)discard;
  gl_FragColor=vec4(radiance/max(alpha,.0001),alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function CloudVolume({position,weather,quality,seed}:{position:[number,number,number];weather:SimulatedWeather;quality:'low'|'high';seed:number}) {
  const mesh=useRef<THREE.Mesh>(null);
  const uniforms=useMemo(()=>({
    cameraLocal:{value:new THREE.Vector3()},
    cloudTint:{value:new THREE.Color(weather==='sunny'?'#f3f7fa':weather==='overcast'?'#c2ccd5':'#91a5b5')},
    thickness:{value:weather==='sunny'?1.8:2.8},seed:{value:seed},
  }),[weather,seed]);
  const defines=useMemo(()=>({STEPS:CLOUD_STEPS[quality]}),[quality]);
  return <mesh position={position} scale={[43,20,27]} renderOrder={-10}
    ref={mesh} onBeforeRender={(_renderer,_scene,camera)=>{
      camera.getWorldPosition(uniforms.cameraLocal.value);
      mesh.current?.worldToLocal(uniforms.cameraLocal.value);
    }}>
    <boxGeometry args={[2,2,2]}/>
    <shaderMaterial key={quality} uniforms={uniforms} defines={defines} vertexShader={vertexShader} fragmentShader={fragmentShader}
      transparent depthWrite={false} side={THREE.BackSide}/>
  </mesh>;
}

/** Bounded ray-marched density + Beer–Lambert attenuation, not a fluid/weather solver.
 * Static fields intentionally avoid a continuous render loop, including reduced-motion mode.
 * Eight separated volumes avoid transparent-volume overlap ordering and cap fragment work.
 */
export function VolumetricClouds({weather,quality='low'}:{weather:SimulatedWeather;quality?:CloudQuality}) {
  if(quality==='off')return null;
  return <group>
    {Array.from({length:8},(_,i)=>{
      const angle=i*Math.PI/4;
      return <CloudVolume key={i} position={[Math.cos(angle)*300,110+(i%3)*13,Math.sin(angle)*300]} weather={weather} quality={quality} seed={i*13.7}/>;
    })}
  </group>;
}
