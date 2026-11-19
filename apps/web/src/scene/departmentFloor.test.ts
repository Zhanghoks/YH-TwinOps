import {expect,it} from 'vitest';
import {departmentFloorPanels} from './departmentFloor';
it('keeps visual panels within supplied reference bounds without changing them',()=>{const r=[{code:'F01',label:'蔬果',zoneIds:[],bounds:{x0:-10,x1:10,z0:3,z1:8}}] as Parameters<typeof departmentFloorPanels>[0];const before=structuredClone(r);const p=departmentFloorPanels(r);expect(p[0]).toMatchObject({x:0,z:5.5,width:20,depth:5});expect(r).toEqual(before);});
