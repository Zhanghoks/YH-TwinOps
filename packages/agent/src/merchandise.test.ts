import {describe,it,expect} from 'vitest';
import {makeTestLayout,TEST_AT} from '@yh/contracts/testing';
import {projectTwinState} from '@yh/twin-state';
import type {MerchandisingSnapshot} from '@yh/contracts';
import {createAgentTools} from './tools';
import {answerLocally} from './rules';
import type {AssistantMessage,ToolCall,TextContent} from '@earendil-works/pi-ai';
import {answerWithPi,piToolSpecs} from './pi-adapter';

const twin=projectTwinState([],makeTestLayout(),TEST_AT);
const merchandise:MerchandisingSnapshot={
 version:1,at:TEST_AT,storeId:twin.storeId,synthetic:true,
 products:[{sku:'YH-LOCAL-001',name:'示意饼干',category:'包装食品',modelKey:'biscuit',referenceSizeMm:[80,40,120],temperatureZone:'常温',synthetic:true}],
 placements:[{placementId:'F077/slot-a',storeId:twin.storeId,fixtureId:'F077',slotId:'slot-a',sku:'YH-LOCAL-001',origin:'USER_SANDBOX',synthetic:true}],
 stockObservations:[],coveredFixtureIds:['F077','F107'],inventory:[{sku:'YH-LOCAL-001',fixtureId:'F077',onHand:null,unit:'件',kind:'UNKNOWN',stale:false,sourceId:null,observedAt:null,evidenceIds:[],synthetic:true,reason:'no-observation'}],
};
describe('商品只读工具与诚实规则',()=>{
 it('旧上下文保留原工具；商品缺失明确 UNKNOWN',()=>{
  const tools=createAgentTools({snapshot:twin,signals:[]});
  expect(tools.get_store_overview().status).toBe('OK');
  expect(tools.get_fixture_products({fixtureId:'F077'})).toMatchObject({status:'UNKNOWN',data:{reason:'merchandise-unavailable'}});
  expect(answerLocally('YH-LOCAL-001 库存多少？',tools).answer).toContain('UNKNOWN');
  expect(piToolSpecs()).toHaveLength(11);
 });
 it('区分已覆盖空陈列和未覆盖，陈列不冒充库存',()=>{
  const tools=createAgentTools({snapshot:twin,signals:[],merchandise});
  expect(tools.get_fixture_products({fixtureId:'F107'})).toMatchObject({status:'OK',data:{placements:[]}});
  expect(tools.get_fixture_products({fixtureId:'F999'}).status).toBe('UNKNOWN');
  const answer=answerLocally('F077 放了什么商品？YH-LOCAL-001 还有多少库存？',tools);
  expect(answer.toolCalls.map(c=>c.tool)).toEqual(['get_fixture_products','get_sku_inventory']);
  expect(answer.answer).toContain('示意饼干');
  expect(answer.answer).toContain('UNKNOWN');
  expect(answer.answer).toContain('不是库存');
  expect(answer.cannotJudge.length).toBeGreaterThan(0);
 });
 it('SKU 跨设施独立且过期值不用于决策，证据保留',()=>{
  const current={...merchandise.inventory[0]!,onHand:12,kind:'OBSERVED' as const,sourceId:'synthetic-stock-fixture',observedAt:TEST_AT,evidenceIds:['stock-1']};
  const expired={...current,fixtureId:'F107',onHand:null,kind:'UNKNOWN' as const,stale:true,reason:'expired' as const};
  const tools=createAgentTools({snapshot:twin,signals:[],merchandise:{...merchandise,inventory:[current,expired]}});
  const result=tools.get_sku_inventory({sku:'YH-LOCAL-001'});
  expect(result.status).toBe('UNKNOWN');
  expect(result.data['readings']).toHaveLength(2);
  expect(result.data).not.toHaveProperty('total');
  expect(answerLocally('F077 YH-LOCAL-001 库存多少？',tools).answer).toContain('12 件');
  expect(answerLocally('F107 YH-LOCAL-001 库存多少？',tools).answer).toContain('UNKNOWN');
 });
 it('无效参数和错时快照安全拒绝',()=>{
  const tools=createAgentTools({snapshot:twin,signals:[],merchandise});
  expect(tools.get_sku_inventory({sku:''}).status).toBe('ERROR');
  expect(tools.get_fixture_products({fixtureId:'F077',extra:true} as {fixtureId:string}).status).toBe('ERROR');
  const mismatched=createAgentTools({snapshot:twin,signals:[],merchandise:{...merchandise,at:'2000-01-01T00:00:00Z'}});
  expect(mismatched.get_fixture_products({fixtureId:'F077'}).status).toBe('UNKNOWN');
 });
});

it('pi 白名单调用两项真实只读工具，非法参数不扩权限',async()=>{
 const tools=createAgentTools({snapshot:twin,signals:[],merchandise});
 const reply=(content:(ToolCall|TextContent)[]):AssistantMessage=>({role:'assistant',content,api:'openai-completions',provider:'openai',model:'test',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:0});
 let count=0;
 const answer=await answerWithPi({modelLabel:'test',complete:async context=>{
  if(count++===0)return reply([{type:'toolCall',id:'1',name:'get_fixture_products',arguments:{fixtureId:'F077'}},{type:'toolCall',id:'2',name:'get_sku_inventory',arguments:{sku:'YH-LOCAL-001'}}]);
  const results=context.messages.filter(m=>m.role==='toolResult');
  expect(JSON.stringify(results)).toContain('slot-a');
  expect(JSON.stringify(results)).toContain('UNKNOWN');
  return reply([{type:'text',text:'已查询；库存 UNKNOWN。'}]);
 }},'F077 和库存',tools);
 expect(answer.toolCalls.map(t=>t.tool)).toEqual(['get_fixture_products','get_sku_inventory']);
 expect(answer.cannotJudge.length).toBeGreaterThan(0);
 expect(answer.evidence[0]?.signalId).toBe('F077/slot-a');
});

it('160 格只摘要正文，试摆 SKU/货位优先且全量证据及工具不丢失',()=>{
 const seed={...merchandise.products[0]!,sku:'YH-DEMO-001',name:'原商品'};
 const placements=Array.from({length:160},(_,i)=>({...merchandise.placements[0]!,placementId:'F077/slot-'+i,slotId:'slot-'+i,sku:i===159?'YH-LOCAL-001':seed.sku,origin:i===159?'USER_SANDBOX' as const:'SEED' as const}));
 const tools=createAgentTools({snapshot:twin,signals:[],merchandise:{...merchandise,products:[seed,...merchandise.products],placements}});
 const answer=answerLocally('F077 放了什么商品？YH-LOCAL-001 还有多少库存？',tools);
 expect(answer.answer.length).toBeLessThan(1600);
 expect(answer.answer).toContain('已试摆货位 slot-159');
 expect(answer.answer).toContain('USER_SANDBOX');
 expect(answer.answer).toContain('YH-LOCAL-001');
 expect(answer.answer).not.toContain('slot-158');
 expect(answer.evidence).toHaveLength(160);
 expect(tools.get_fixture_products({fixtureId:'F077'}).data['placements']).toHaveLength(160);
 expect(answer.toolCalls.map(c=>c.tool)).toEqual(['get_fixture_products','get_sku_inventory']);
});
