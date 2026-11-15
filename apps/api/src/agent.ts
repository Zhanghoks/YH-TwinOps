/**
 * 门店助手 API：服务端回答引擎（默认本地规则；配置 YH_AGENT_* 后走 pi-ai）。
 * 凭证只读进程环境，绝不回传浏览器。工具数值仍来自请求里的合成孪生快照。
 */
import { createAnswerEngine, createAgentTools, type EngineEnv, type PiAgentAnswer } from '@yh/agent';
import type { AgentAnswer } from '@yh/agent/rules';
import { parseStoreLayout, parseTwinSignal, type StoreLayout, type TwinSignal } from '@yh/contracts';
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

export function parseAskBody(body: unknown): { ok: true; value: { question: string; at: string; layout: StoreLayout; signals: TwinSignal[] } } | { ok: false; error: string } {
  if (body === null || typeof body !== 'object') return { ok: false, error: '请求体必须是 JSON 对象' };
  const raw = body as Partial<AgentAskBody>;
  if (typeof raw.question !== 'string' || raw.question.trim().length === 0) {
    return { ok: false, error: '缺少 question（非空字符串）' };
  }
  if (typeof raw.at !== 'string' || raw.at.length === 0) {
    return { ok: false, error: '缺少 at（情景时刻 ISO）' };
  }
  if (!Array.isArray(raw.signals)) return { ok: false, error: '缺少 signals 数组' };
  try {
    const layout = parseStoreLayout(raw.layout);
    const signals = raw.signals.map((s, i) => {
      try {
        return parseTwinSignal(s);
      } catch (error) {
        throw new Error(`signals[${i}] 无效：${error instanceof Error ? error.message : String(error)}`);
      }
    });
    return { ok: true, value: { question: raw.question.trim(), at: raw.at, layout, signals } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function askAgent(input: { question: string; at: string; layout: StoreLayout; signals: TwinSignal[] }, env: NodeJS.ProcessEnv = process.env): Promise<AgentAskResult> {
  const snapshot = projectTwinState(input.signals, input.layout, input.at);
  const tools = createAgentTools({ snapshot, signals: input.signals });
  const engine = createAnswerEngine(tools, readEngineEnv(env));
  return engine.answer(input.question);
}
