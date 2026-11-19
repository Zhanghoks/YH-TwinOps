import {expect,it} from 'vitest';
import {buildCityGroundPixels} from './cityGroundTexture';
it('builds deterministic bounded opaque maps without external images',()=>{
 const p=buildCityGroundPixels(130,100,32);
 expect(p).toEqual(buildCityGroundPixels(130,100,32));
 expect(p.length).toBe(32*32*4);
 expect(new Set(p.filter((_,i)=>i%4!==3)).size).toBeGreaterThan(10);
 for(let i=3;i<p.length;i+=4)expect(p[i]).toBe(255);
 expect(()=>buildCityGroundPixels(130,100,2048)).toThrow();
});

it('aligns near and far maps with the same world coordinates',()=>{expect(buildCityGroundPixels(130,100,16,900,900).length).toBe(16*16*4);});
