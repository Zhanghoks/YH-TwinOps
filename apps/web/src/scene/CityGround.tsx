import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import {buildCityGroundPixels} from './cityGroundTexture';
/** One shared-size map, constant draw-call count and no external asset/license dependency. */
export function useCityGroundTexture(width:number,depth:number,distant=false):THREE.DataTexture {
 const texture=useMemo(()=>{
  const t=new THREE.DataTexture(buildCityGroundPixels(width,depth,512,distant?900:260,distant?900:300),512,512,THREE.RGBAFormat);
  t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;
  t.needsUpdate=true;return t;
 },[width,depth,distant]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return texture;
}
