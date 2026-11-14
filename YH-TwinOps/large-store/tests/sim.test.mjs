import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeSimulationEngine} from '../simulation.js';
const layout=JSON.parse(fs.readFileSync(new URL('../layout.json',import.meta.url)));
const {simulate,validate,candidates}=makeSimulationEngine(layout);

test('metadata marks all dimensions as synthetic; layout around 4000 m²',()=>{
 assert.equal(layout.synthetic,true);assert.equal(layout.area_m2,4000);
 assert.equal(layout.zones.length,17);
});
test('base geometry has no fixture collisions',()=>{
 assert.ok(validate(layout.fixtures).ok);
});
test('all candidate schemes are buildable and have walkable customer routes',()=>{
 for(const p of candidates()){
  assert.equal(validate(p.fixtures).ok,true,p.id);
  const r=simulate(p.fixtures);
  assert.equal(r.miss,0,p.id);
  assert.equal(r.paths.length,68);
  assert.ok(r.avgDist>30&&r.avgDist<1200);
 }
});
test('identical seed and layout yield identical metrics',()=>{
 const a=simulate(layout.fixtures),b=simulate(layout.fixtures);
 assert.equal(a.avgDist,b.avgDist);assert.equal(a.congestion,b.congestion);
});
test('different layouts alter computed route outcomes',()=>{
 const [a,b,c]=candidates();
 const x=simulate(a.fixtures),y=simulate(b.fixtures),z=simulate(c.fixtures);
 assert.ok(x.avgDist!==y.avgDist||x.congestion!==y.congestion);
 assert.ok(x.avgDist!==z.avgDist||x.congestion!==z.congestion);
});
test('layout contract: entrances, exits and the documented fixture count',()=>{
 assert.ok(layout.entrances.length>=1,'entrances');
 assert.ok(layout.exits.length>=1,'exits');
 assert.equal(layout.fixtures.length,150);
});
test('the two change candidates are pairwise distinct and differ from the base',()=>{
 const key=(p)=>JSON.stringify(p.fixtures);
 const all=candidates();
 const base=all.find(p=>p.id==='base');
 assert.ok(base,'a base candidate exists');
 const others=all.filter(p=>p.id!=='base');
 assert.equal(others.length,2);
 assert.equal(new Set(others.map(key)).size,2,'change candidates are distinct');
 for(const p of others)assert.notEqual(key(p),key(base),p.id);
});
