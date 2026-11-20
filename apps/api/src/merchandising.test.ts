import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {parseStoreLayout} from '@yh/contracts';
import {getMerchandisingAuthority} from '@yh/merchandising/authority';
import {createAgentTools} from '@yh/agent';
import {answerLocally} from '@yh/agent/rules';
import {projectTwinState} from '@yh/twin-state';
import {askAgent,parseAskBody} from './agent';

const at='2026-11-15T18:00:00Z';
// Test fixture uses server-owned generated authority, not re-invented client slots.
const authorityData=JSON.parse(readFileSync(new URL('../../../packages/merchandising/src/authority-data.json',import.meta.url),'utf8')) as {fixtures:Record<string,unknown>[]};
const zones=[['zone-produce','PRODUCE'],['zone-frozen','FROZEN'],['zone-daily','DAIRY'],['zone-packaged','GROCERY'],['zone-household','HOUSEHOLD']];
function body() {
 const layout=parseStoreLayout({storeId:'store-yh-01',name:'教学测试',synthetic:true,widthM:130,depthM:100,zones:zones.map(([zoneId,zoneType])=>({zoneId,name:zoneId,zoneType})),fixtures:authorityData.fixtures.map(({designVariant,...f})=>({...f,...(designVariant===null?{}:{designVariant}),assetId:'synthetic-test',fixed:true,categoryIds:[]}))});
 const authority=getMerchandisingAuthority(layout);
 if(!authority)throw new Error('test canonical authority missing');
 return {question:'F077 放了什么商品？',at,layout,signals:[],merchandising:{contextVersion:1,products:authority.seedProducts,placements:authority.baselinePlacements,stockObservations:[]}};
}
describe('Agent 商品上下文的 API 可信边界',()=>{
 it('完整 596 映射 API/本地规则同一事实，无库存推断',async()=>{
  const raw=body();
  const result=parseAskBody(raw);
  expect(result.ok).toBe(true);
  if(!result.ok)throw new Error(result.error);
  const local=answerLocally(raw.question,createAgentTools({snapshot:projectTwinState([],raw.layout,at),signals:[],merchandise:result.value.merchandise}));
  const api=await askAgent(result.value,{});
  expect(api).toEqual(local);
  expect(api.answer).toContain('不是库存');
 });
 it.each([
  ['伪造 slot',(b:ReturnType<typeof body>)=>({...b,merchandising:{...b.merchandising,placements:b.merchandising.placements.map((p,i)=>i===0?{...p,slotId:'forged'}:p)}})],
  ['伪造 slots 授权',(b:ReturnType<typeof body>)=>({...b,merchandising:{...b.merchandising,validSlotIdsByFixture:{F077:['forged']}}})],
  ['伪造几何',(b:ReturnType<typeof body>)=>({...b,layout:{...b.layout,fixtures:b.layout.fixtures.map(f=>f.fixtureId==='F077'?{...f,widthM:999}:f)}})],
  ['漏基线',(b:ReturnType<typeof body>)=>({...b,merchandising:{...b.merchandising,placements:b.merchandising.placements.slice(1)}})],
  ['非合成商品',(b:ReturnType<typeof body>)=>({...b,merchandising:{...b.merchandising,products:b.merchandising.products.map((p,i)=>i===0?{...p,synthetic:false}:p)}})],
  ['超预算',(b:ReturnType<typeof body>)=>({...b,merchandising:{...b.merchandising,products:Array(65).fill(b.merchandising.products[0])}})],
  ['对象替代数组',(b:ReturnType<typeof body>)=>({...b,merchandising:{...b.merchandising,stockObservations:{}}})],
  ['额外脚本字段',(b:ReturnType<typeof body>)=>({...b,merchandising:{...b.merchandising,products:b.merchandising.products.map((p,i)=>i===0?{...p,script:'evil'}:p)}})],
  ['非法时刻',(b:ReturnType<typeof body>)=>({...b,at:'2026-02-30T18:00:00Z'})],
  ['错误 contextVersion',(b:ReturnType<typeof body>)=>({...b,merchandising:{...b.merchandising,contextVersion:2}})],
 ])('拒绝 %s',(_name,mutate)=>{expect(parseAskBody(mutate(body())).ok).toBe(false);});
 it('合成库存数量/证据/过期在 API 与离线工具一致，拒绝错误关联和类型',async()=>{
  const raw=body();
  const placement=raw.merchandising.placements.find(p=>p.fixtureId==='F077')!;
  const observation={id:'stock-demo',storeId:raw.layout.storeId,zoneId:'zone-packaged',fixtureId:'F077',sku:placement.sku,quantity:17,unit:'件',kind:'OBSERVED',synthetic:true,sourceId:'synthetic-stock-fixture',observedAt:at,ingestedAt:at,validUntil:'2026-11-15T18:05:00Z'};
  const withStock={...raw,question:`F077 ${placement.sku} 库存多少？`,merchandising:{...raw.merchandising,stockObservations:[observation]}};
  const parsed=parseAskBody(withStock);
  if(!parsed.ok)throw new Error(parsed.error);
  const answer=await askAgent(parsed.value,{});
  expect(answer.answer).toContain('17 件');
  expect(answer.evidence).toContainEqual(expect.objectContaining({signalId:'stock-demo',sourceId:'synthetic-stock-fixture',kind:'OBSERVED',synthetic:true}));
  const stale=parseAskBody({...withStock,at:'2026-11-15T18:06:00Z'});
  if(!stale.ok)throw new Error(stale.error);
  const expired=await askAgent(stale.value,{});
  expect(expired.answer).toContain('UNKNOWN（已过期）');
  expect(expired.answer).not.toContain('17 件');
  expect(expired.evidence).toContainEqual(expect.objectContaining({signalId:'stock-demo',kind:'OBSERVED'}));
  for(const patch of [{quantity:-1},{quantity:'17'},{kind:'UNKNOWN',quantity:17},{kind:'SIMULATED'},{kind:'ESTIMATED'},{zoneId:'zone-frozen'},{synthetic:false},{sku:'YH-NOT-IN-CATALOG'},{observedAt:'bad-date'},{extra:'not allowed'}]) {
   expect(parseAskBody({...withStock,merchandising:{...withStock.merchandising,stockObservations:[{...observation,...patch}]}}).ok).toBe(false);
  }
 });
 it('无 merchandising 保持旧接口兼容，商品回答 UNKNOWN',async()=>{
  const {merchandising:_,...raw}=body();
  const parsed=parseAskBody(raw);
  expect(parsed.ok).toBe(true);
  if(parsed.ok)expect((await askAgent(parsed.value,{})).answer).toContain('UNKNOWN');
 });
});
