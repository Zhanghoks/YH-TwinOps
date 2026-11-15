export type { AgentEvidence, AgentToolResult, AgentToolDeps, AgentTools } from './tools';
export { createAgentTools } from './tools';
export type { AgentAnswer } from './rules';
export { answerLocally } from './rules';
export type { PiAgentAnswer, PiAgentOptions, PiBackendConfig, PiCompleteFn } from './pi-adapter';
export { AGENT_SYSTEM_PROMPT, answerWithPi, createPiComplete, piToolSpecs } from './pi-adapter';

import type { Context } from '@earendil-works/pi-ai';
import { answerLocally, type AgentAnswer } from './rules';
import { answerWithPi, createPiComplete, type PiAgentAnswer } from './pi-adapter';
import type { AgentTools } from './tools';

export * from '@yh/contracts';
export * from '@yh/twin-state';
export * from '@yh/simulation';

/**
 * 回答引擎工厂：默认本地规则（离线可演示）；配置了 provider+model 才启用 pi LLM 后端。
 * 凭证只从服务端环境读取，绝不进浏览器（PRD §4.4）。
 */
export interface EngineEnv {
  YH_AGENT_PROVIDER?: string;
  YH_AGENT_MODEL?: string;
  YH_AGENT_API_KEY?: string;
  YH_AGENT_MAX_TOOL_ITERATIONS?: string;
}

export interface AnswerEngine {
  kind: 'rules-local' | 'pi-llm';
  /** rules 模式为本地版本号；LLM 模式为 provider/model，UI 必须如实展示。 */
  model: string;
  answer(question: string): Promise<AgentAnswer | PiAgentAnswer>;
}

export function createAnswerEngine(tools: AgentTools, env: EngineEnv): AnswerEngine {
  if (env.YH_AGENT_PROVIDER !== undefined && env.YH_AGENT_PROVIDER.length > 0 && env.YH_AGENT_MODEL !== undefined && env.YH_AGENT_MODEL.length > 0) {
    const { complete, label } = createPiComplete({
      provider: env.YH_AGENT_PROVIDER,
      modelId: env.YH_AGENT_MODEL,
      apiKey: env.YH_AGENT_API_KEY,
    });
    const maxToolIterations = env.YH_AGENT_MAX_TOOL_ITERATIONS === undefined ? undefined : Number.parseInt(env.YH_AGENT_MAX_TOOL_ITERATIONS, 10);
    return {
      kind: 'pi-llm',
      model: label,
      answer: (question: string) => answerWithPi({ complete, modelLabel: label, maxToolIterations }, question, tools),
    };
  }
  return {
    kind: 'rules-local',
    model: 'yh-rules-local-0.1',
    answer: async (question: string) => answerLocally(question, tools),
  };
}

// Context 类型仅用于文档化引擎与 pi 的边界；运行时不直接引用。
export type { Context };
