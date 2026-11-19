import {expect,it} from 'vitest';
import {buildCityFacadePixels,hasCityFacade} from './cityFacade';
it('uses original deterministic bounded opaque window pixels',()=>{const p=buildCityFacadePixels();expect(p).toEqual(buildCityFacadePixels());expect(p.length).toBe(128*128*4);for(let i=3;i<p.length;i+=4)expect(p[i]).toBe(255);});
it('only textures building wall masses, not store, roofs or terrain',()=>{for(const id of ['fabric-block--2-3-streetwall-a','fabric-block-2-3-corner','city-far-side--1-2','city-far-south-0'])expect(hasCityFacade(id)).toBe(true);for(const id of ['front-fascia','fabric-block-2-3-roof-a','city-far-side-cap--1-2','site-plaza'])expect(hasCityFacade(id)).toBe(false);});
