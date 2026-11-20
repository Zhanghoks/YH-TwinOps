import { describe,it,expect } from 'vitest'
import * as THREE from 'three'
import {buildDetailedProduct,DETAILED_PRODUCT_KINDS} from './detailedProduct'
import {makeDetailedProduct,disposeDetailedProduct} from './detailedProductThree'
describe('bounded independent product silhouettes',()=>{
 for(const kind of DETAILED_PRODUCT_KINDS)it(`${kind}: near/far keep supplied bounds and ground contact`,()=>{
  for(const lod of ['near','far'] as const)for(const size of [[.12,.18,.09],[.6,.22,.4],[.08,.7,.13]] as const){
   const g=makeDetailedProduct({kind,size,color:'#aa5544',lod});g.updateMatrixWorld(true)
   const b=new THREE.Box3().setFromObject(g),eps=1e-7
   expect(b.min.x).toBeGreaterThanOrEqual(-size[0]/2-eps);expect(b.max.x).toBeLessThanOrEqual(size[0]/2+eps)
   expect(b.min.z).toBeGreaterThanOrEqual(-size[2]/2-eps);expect(b.max.z).toBeLessThanOrEqual(size[2]/2+eps)
   expect(b.min.y).toBeCloseTo(0,7);expect(b.max.y).toBeLessThanOrEqual(size[1]+eps)
   expect(g.children.length).toBeLessThanOrEqual(10)
   let triangles=0;g.traverse(o=>{if(o instanceof THREE.Mesh){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;expect((o.material as THREE.MeshStandardMaterial).map).toBeNull();expect((o.material as THREE.MeshStandardMaterial).roughness).toBe(.66)}})
   expect(triangles).toBeLessThan(1800);disposeDetailedProduct(g)
  }
 })
 it('detergent handle has two pillars, bridge and a genuinely ray-clear hole',()=>{
  for(const lod of ['near','far'] as const){const g=makeDetailedProduct({kind:'handled-detergent',size:[1,1,1],color:'#537b84',lod});g.updateMatrixWorld(true)
   const ray=new THREE.Raycaster(new THREE.Vector3(.305,.69,2),new THREE.Vector3(0,0,-1))
   expect(ray.intersectObject(g,true)).toHaveLength(0)
   for(const x of [.16,.45]){ray.set(new THREE.Vector3(x,.69,2),new THREE.Vector3(0,0,-1));expect(ray.intersectObject(g,true).length).toBeGreaterThan(0)}disposeDetailedProduct(g)
  }
 })
 it('far is no more expensive and removes fine dressing',()=>{
  for(const kind of DETAILED_PRODUCT_KINDS){const opts={kind,size:[1,1,1] as const,color:'#888888'};const n=buildDetailedProduct({...opts,lod:'near'}),f=buildDetailedProduct({...opts,lod:'far'});expect(f.parts.length).toBeLessThanOrEqual(n.parts.length)}
 })
 it('rejects invalid dimensions rather than expanding or producing NaNs',()=>{for(const v of [0,-1,NaN,Infinity])expect(()=>buildDetailedProduct({kind:'can',size:[v,1,1],color:'#fff'})).toThrow()})
})
