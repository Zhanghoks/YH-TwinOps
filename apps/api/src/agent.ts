/**
 * 门店助手 API：服务端回答引擎（默认本地规则；配置 YH_AGENT_* 后走 pi-ai）。
 * 凭证只读进程环境，绝不回传浏览器。工具数值仍来自请求里的合成孪生快照。
 */
import { createAnswerEngine, createAgentTools, type EngineEnv, type PiAgentAnswer } from '@yh/agent';
import type { AgentAnswer } from '@yh/agent/rules';
import { parseStoreLayout, parseTwinSignal, type StoreLayout, type TwinSignal } from '@yh/contracts';
import { merchandisingSubmissionSchema, type MerchandisingSnapshot } from '@yh/contracts';
import { projectMerchandisingState } from '@yh/merchandising';
import { validateMerchandisingSubmission } from '@yh/merchandising/authority';
import { projectTwinState } from '@yh/twin-state';

export type AgentAskResult = AgentAnswer | PiAgentAnswer;

export interface AgentStatus {
  ok: true;
  service: 'yh-agent';
  engine: 'rules-local' | 'pi-llm';
  model: string;
  note: string;
}

export interface AgentAskBody {
  question: string;
  at: string;
  layout: unknown;
  signals: unknown[];
  merchandising?: unknown;
}

function readEngineEnv(env: NodeJS.ProcessEnv = process.env): EngineEnv {
  return {
    YH_AGENT_PROVIDER: env.YH_AGENT_PROVIDER,
    YH_AGENT_MODEL: env.YH_AGENT_MODEL,
    YH_AGENT_API_KEY: env.YH_AGENT_API_KEY,
    YH_AGENT_MAX_TOOL_ITERATIONS: env.YH_AGENT_MAX_TOOL_ITERATIONS,
  };
}

export function getAgentStatus(env: NodeJS.ProcessEnv = process.env): AgentStatus {
  const engineEnv = readEngineEnv(env);
  const configured =
    engineEnv.YH_AGENT_PROVIDER !== undefined &&
    engineEnv.YH_AGENT_PROVIDER.length > 0 &&
    engineEnv.YH_AGENT_MODEL !== undefined &&
    engineEnv.YH_AGENT_MODEL.length > 0;
  if (!configured) {
    return {
      ok: true,
      service: 'yh-agent',
      engine: 'rules-local',
      model: 'yh-rules-local-0.1',
      note: '未配置 YH_AGENT_PROVIDER/MODEL：离线本地规则；配置后由服务端 pi-ai 驱动，凭证不进浏览器',
    };
  }
  return {
    ok: true,
    service: 'yh-agent',
    engine: 'pi-llm',
    model: `${engineEnv.YH_AGENT_PROVIDER}/${engineEnv.YH_AGENT_MODEL}`,
    note: 'pi-ai 已启用（服务端）；LLM 只组织语言与工具调用，数值来自确定性工具',
  };
}

export interface ParsedAskBody {
  question:string;
  at:string;
  layout:StoreLayout;
  signals:TwinSignal[];
  merchandise?:MerchandisingSnapshot;
}

/** Reject over-budget/unknown fields before projection; slot authority is server-owned. */
export function parseAskBody(body: unknown): { ok: true; value: ParsedAskBody } | { ok: false; error: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: '请求体必须是 JSON 对象' };
  const raw = body as Record<string,unknown>;
  if(Object.keys(raw).some(k=>!['question','at','layout','signals','merchandising'].includes(k)))return {ok:false,error:'请求体包含未支持字段'};
  if(typeof raw.question!=='string'||raw.question.trim().length===0||raw.question.length>4000)return {ok:false,error:'question 必须是 1–4000 字符'};
  if(typeof raw.at!=='string'||raw.at.length>40||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(raw.at)||!Number.isFinite(Date.parse(raw.at)))return {ok:false,error:'at 必须是有效 UTC ISO 时间'};
  // Date.parse normalizes impossible dates such as February 30; reject those too.
  if(new Date(raw.at).toISOString().slice(0,19)!==raw.at.slice(0,19))return {ok:false,error:'at 包含不存在的日期'};
  if(!Array.isArray(raw.signals)||raw.signals.length>20000)return {ok:false,error:'signals 必须是数组且不超过 20000 项'};
  try {
    const layout=parseStoreLayout(raw.layout);
    if(!layout.synthetic)throw new Error('只接受合成教学 layout');
    const signals=raw.signals.map((value,i)=>{
      const signal=parseTwinSignal(value);
      if(!signal.synthetic)throw new Error(`signals[${i}] 必须 synthetic:true`);
      return signal;
    });
    let merchandise:MerchandisingSnapshot|undefined;
    if(raw.merchandising!==undefined) {
      const submission=merchandisingSubmissionSchema.parse(raw.merchandising);
      const authoritative=validateMerchandisingSubmission(layout,submission);
      merchandise=projectMerchandisingState({...authoritative,at:raw.at,layout});
    }
    return {ok:true,value:{question:raw.question.trim(),at:raw.at,layout,signals,...(merchandise===undefined?{}:{merchandise})}};
  } catch(error) {
    return {ok:false,error:error instanceof Error?error.message:String(error)};
  }
}

export async function askAgent(input: ParsedAskBody, env: NodeJS.ProcessEnv = process.env): Promise<AgentAskResult> {
  const snapshot = projectTwinState(input.signals, input.layout, input.at);
  const tools = createAgentTools({ snapshot, signals: input.signals, merchandise: input.merchandise });
  const engine = createAnswerEngine(tools, readEngineEnv(env));
  return engine.answer(input.question);
}
