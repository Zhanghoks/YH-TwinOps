import {describe,it,expect} from 'vitest';
import {layout as baseline} from '../data';
import {generatePlanningLayout,buildReferenceDisplayFixtures} from './planningLayout';
import {planFixtureReplacements} from './fixtureReplacementPlan';

describe('conservative fixed-size replacement planning',()=>{
 for(const dense of [false,true])it(`audits ${dense?'dense':'baseline'} without mutating or enabling unsafe replacement`,()=>{
  const layout=dense?generatePlanningLayout(baseline).layout:baseline;
  const decorations=dense?buildReferenceDisplayFixtures(layout):[];
  const before=JSON.stringify({layout,decorations}),plan=planFixtureReplacements(layout,decorations);
  expect(JSON.stringify({layout,decorations})).toBe(before);
  expect(plan).toHaveLength(layout.fixtures.length+decorations.length);
  expect(plan.map(p=>p.fixtureId)).toEqual([...layout.fixtures,...decorations].map(f=>f.fixtureId));
  expect(plan.every(p=>p.status==='keep-legacy'&&p.transform.scale===1)).toBe(true);
  expect(plan.every(p=>p.asset===null||p.reasons.includes('product-remount-required'))).toBe(true);
  expect(plan.filter(p=>p.geometryCandidate)).toHaveLength(dense?0:12);
  const reasons=plan.reduce((out,p)=>{for(const r of p.reasons)out[r]=(out[r]??0)+1;return out;},{} as Record<string,number>);
  expect(reasons).toEqual(dense?{'unsupported-category':41,'height-too-small':144,'front-unverified':45,'product-remount-required':164,'group-footprint-underfilled':49,'footprint-too-small':26}:{'unsupported-category':40,'height-too-small':95,'group-footprint-underfilled':47,'front-unverified':37,'operation-clearance-blocked':10,'product-remount-required':110,'footprint-too-small':19});
 });
 it('does not rotate or stretch a narrow bay into a fixed gondola',()=>{
  const f={...baseline.fixtures.find(f=>f.fixtureType==='GONDOLA')!,fixtureId:'small',zoneId:'zone-packaged',x:0,z:0,widthM:1,depthM:3,heightM:2,rotationY:Math.PI/2};
  const p=planFixtureReplacements({...baseline,fixtures:[f]})[0]!;
  expect(p.reasons).toContain('footprint-too-small');expect(p.transform.rotationY).toBe(Math.PI/2);
 });
 it('checks both gondola service faces and retains goods even when geometry fits',()=>{
  const f={...baseline.fixtures.find(f=>f.fixtureType==='GONDOLA')!,fixtureId:'g',zoneId:'zone-packaged',x:0,z:0,widthM:2.4,depthM:1,heightM:1.6,rotationY:0};
  const clean=planFixtureReplacements({...baseline,fixtures:[f]})[0]!;
  expect(clean.geometryCandidate).toBe(true);expect(clean.status).toBe('keep-legacy');
  const blocked=planFixtureReplacements({...baseline,fixtures:[f,{...f,fixtureId:'neighbor',z:-1.3}]})[0]!;
  expect(blocked.reasons).toContain('operation-clearance-blocked');
 });
});
it('packs unscaled side-by-side modules under the existing group ID and exposes empty-only preview',()=>{
 const f={...baseline.fixtures.find(f=>f.fixtureType==='GONDOLA')!,fixtureId:'group',zoneId:'zone-packaged',x:0,z:0,widthM:7.5,depthM:1,heightM:1.6,rotationY:0};
 const p=planFixtureReplacements({...baseline,fixtures:[f]})[0]!;
 expect(p.preview?.mode).toBe('empty-geometry-only');
 expect(p.preview?.moduleOffsetsX).toEqual([-2.4,0,2.4]);
 expect(p.fixtureId).toBe('group');expect(p.geometryCandidate).toBe(true);
 expect(p.preview!.moduleOffsetsX.every(x=>Math.abs(x)+1.2<=f.widthM/2)).toBe(true);
 expect(p.reasons).toEqual(['product-remount-required']);
 const deep=planFixtureReplacements({...baseline,fixtures:[{...f,depthM:4}]})[0]!;
 expect(deep.reasons).toContain('group-footprint-underfilled');expect(deep.geometryCandidate).toBe(false);
});
