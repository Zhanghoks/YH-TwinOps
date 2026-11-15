import {
  type ApiKeyCredential,
  type AssistantMessage,
  type Context,
  type Credential,
  type CredentialInfo,
  type CredentialStore,
  type Message,
  type MutableModels,
  type TextContent,
  type Tool,
  type ToolCall,
  type ToolResultMessage,
} from '@earendil-works/pi-ai';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import type { CheckoutScenario } from '@yh/simulation';
import type { AgentEvidence, AgentTools } from './tools';

/**
 * pi harness 后端（@earendil-works/pi-ai）：统一多 provider 的 LLM 接入层。
 * 铁律（PRD §9）：LLM 只负责识别问题、组织查询与组织语言；数值一律来自工具返回；
 * 每次工具结果连同证据进入对话；无凭证时该适配器不可用，走本地规则解释器。
 */

export const AGENT_SYSTEM_PROMPT = [
  '你是永辉风格门店的运营数字孪生 Agent（教学模拟，非永辉官方系统）。',
  '职责：识别店长的问题，调用提供的只读工具获取数据，组织成简明的中文回答。',
  '硬性规则：',
  '1. 一切数值来自工具返回；禁止编造、估算或"补"数字。',
  '2. 数据不足或工具返回 UNKNOWN 时，必须明确说"不能判断"，并复述工具建议的补采动作。',
  '3. 回答关键数字时引用证据（signal id / 来源 / 观测时间 / 分级）。',
  '4. 仿真结果只表述为"模拟情景"，不得说成对真实门店的预测。',
  '5. 你没有写权限：审批由店长触发，你只能产出待审批草案。',
].join('\n');

export interface PiAgentAnswer {
  answer: string;
  mode: 'pi-llm';
  model: string;
  toolCalls: { tool: string; args: Record<string, unknown> }[];
  evidence: AgentEvidence[];
  cannotJudge: string[];
  error?: string;
}

export type PiCompleteFn = (context: Context) => Promise<AssistantMessage>;

/** 把 Agent 工具集映射为 pi-ai 的 Tool 声明（JSON Schema 参数）。 */
export function piToolSpecs(): Tool[] {
  const obj = (properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
    type: 'object',
    properties,
    required,
  });
  const scenarioSchema = {
    type: 'object',
    description: '收银方案配置',
    properties: {
      name: { type: 'string' },
      lanesOpen: { type: 'number' },
      extraStaff: { type: 'number' },
      horizonMin: { type: 'number' },
      baselineLanesOpen: { type: 'number' },
    },
    required: ['name', 'lanesOpen', 'extraStaff', 'horizonMin'],
  } as const;
  return [
    { name: 'get_store_overview', description: '返回全店 KPI、最新告警和数据覆盖状态', parameters: obj({}) },
    { name: 'get_zone_snapshot', description: '返回区域、设施、最新信号及空间关系', parameters: obj({ zoneId: { type: 'string', description: '分区 ID，如 zone-checkout' } }, ['zoneId']) },
    { name: 'query_sales', description: '聚合窗口内 POS SKU/区域销售；注明映射与来源', parameters: obj({ windowMin: { type: 'number', description: '回看分钟数' }, zoneId: { type: 'string', description: '可选分区 ID' } }, ['windowMin']) },
    { name: 'query_traffic', description: '人流/占用/排队信号及是否可用', parameters: obj({ windowMin: { type: 'number' }, zoneId: { type: 'string' } }, ['windowMin']) },
    { name: 'query_operational_alerts', description: '按严重级别获取异常与证据', parameters: obj({}) },
    { name: 'explain_data_gap', description: '解释为什么没有数据、建议采集什么', parameters: obj({ zoneId: { type: 'string' }, metric: { type: 'string' } }, ['zoneId']) },
    {
      name: 'simulate_intervention',
      description: '运行有约束的 what-if 收银仿真（模拟情景）',
      parameters: obj({ scenario: scenarioSchema, seed: { type: 'number' } }, ['scenario']),
    },
    { name: 'compare_scenarios', description: '在当前快照上同种子对比基线/增开通道/调人三方案', parameters: obj({ seed: { type: 'number' } }) },
    { name: 'propose_action_plan', description: '生成待店长审批的任务草案（只写教学沙盒）', parameters: obj({ scenarioId: { type: 'string' }, scenario: scenarioSchema, seed: { type: 'number' } }, ['scenarioId', 'scenario']) },
  ];
}

export interface PiAgentOptions {
  /** 已就绪的 complete 函数（生产用 pi-ai；测试注入假实现）。 */
  complete: PiCompleteFn;
  modelLabel: string;
  maxToolIterations?: number;
  defaultSeed?: number;
}

type ToolFn = (args: never) => { status: string; message?: string; data: Record<string, unknown>; evidence: AgentEvidence[] };

function executeToolCall(call: ToolCall, tools: AgentTools): { name: string; args: Record<string, unknown>; result: { status: string; message?: string; data: Record<string, unknown>; evidence: AgentEvidence[] } } {
  const registry: Record<string, ToolFn> = {
    get_store_overview: () => tools.get_store_overview(),
    get_zone_snapshot: (args) => tools.get_zone_snapshot(args as { zoneId: string }),
    query_sales: (args) => tools.query_sales(args as { windowMin: number; zoneId?: string }),
    query_traffic: (args) => tools.query_traffic(args as { windowMin: number; zoneId?: string }),
    query_operational_alerts: () => tools.query_operational_alerts(),
    explain_data_gap: (args) => tools.explain_data_gap(args as { zoneId: string; metric?: string }),
    simulate_intervention: (args) => tools.simulate_intervention(args as { scenario: CheckoutScenario; seed?: number }),
    compare_scenarios: (args) => tools.compare_scenarios(args as { seed?: number }),
    propose_action_plan: (args) => tools.propose_action_plan(args as { scenarioId: string; scenario: CheckoutScenario; seed?: number }),
  };
  const fn = registry[call.name];
  if (fn === undefined) {
    return { name: call.name, args: call.arguments, result: { status: 'ERROR', message: `未知工具 ${call.name}`, data: {}, evidence: [] } };
  }
  try {
    return { name: call.name, args: call.arguments, result: fn(call.arguments as never) };
  } catch (error) {
    return {
      name: call.name,
      args: call.arguments,
      result: { status: 'ERROR', message: `工具执行异常：${String(error)}`, data: {}, evidence: [] },
    };
  }
}

/**
 * pi 驱动的 agent 循环：complete → 工具调用 → toolResult → 循环，直到模型给出最终文本
 * 或达到迭代上限。工具结果始终连同证据写回对话。
 */
export async function answerWithPi(options: PiAgentOptions, question: string, tools: AgentTools): Promise<PiAgentAnswer> {
  const maxIterations = options.maxToolIterations ?? 6;
  const messages: Message[] = [{ role: 'user', content: question, timestamp: Date.now() }];
  const toolCalls: PiAgentAnswer['toolCalls'] = [];
  const evidence: AgentEvidence[] = [];
  const cannotJudge: string[] = [];
  const context: Context = { systemPrompt: AGENT_SYSTEM_PROMPT, messages, tools: piToolSpecs() };

  for (let i = 0; i < maxIterations; i += 1) {
    const response = await options.complete(context);
    if (response.errorMessage !== undefined) {
      return {
        answer: `LLM 后端调用失败：${response.errorMessage}。无凭证/断网时请使用本地规则模式（默认路径）。`,
        mode: 'pi-llm',
        model: options.modelLabel,
        toolCalls,
        evidence,
        cannotJudge,
        error: response.errorMessage,
      };
    }
    const calls = response.content.filter((block): block is ToolCall => block.type === 'toolCall');
    const textBlocks = response.content.filter((block): block is TextContent => block.type === 'text');
    if (calls.length === 0) {
      const finalText = textBlocks.map((b) => b.text).join('\n').trim();
      return {
        answer: finalText.length > 0 ? finalText : '（模型未返回内容）',
        mode: 'pi-llm',
        model: options.modelLabel,
        toolCalls,
        evidence,
        cannotJudge,
      };
    }
    messages.push(response);
    const toolResults: ToolResultMessage[] = [];
    for (const call of calls) {
      const execution = executeToolCall(call, tools);
      toolCalls.push({ tool: execution.name, args: execution.args });
      evidence.push(...execution.result.evidence);
      if (execution.result.status === 'UNKNOWN') cannotJudge.push(execution.result.message ?? '工具返回 UNKNOWN');
      toolResults.push({
        role: 'toolResult',
        toolCallId: call.id,
        toolName: call.name,
        content: [{ type: 'text', text: JSON.stringify(execution.result) }],
        isError: execution.result.status === 'ERROR',
        timestamp: Date.now(),
      });
    }
    messages.push(...toolResults);
  }
  return {
    answer: `已达工具调用迭代上限（${maxIterations}），以下为已收集证据的诚实小结，而不是编造的结论：\n- 已调用工具：${toolCalls.map((c) => c.tool).join('、') || '无'}\n- 无法判断项：${cannotJudge.length > 0 ? cannotJudge.join('；') : '无'}`,
    mode: 'pi-llm',
    model: options.modelLabel,
    toolCalls,
    evidence,
    cannotJudge,
  };
}

/** 只读的静态凭证存储：把显式 apiKey 提供给指定 provider（凭证仅存在于服务端进程内）。 */
class StaticCredentialStore implements CredentialStore {
  readonly #entries: Map<string, Credential>;

  constructor(entries: Record<string, ApiKeyCredential>) {
    this.#entries = new Map(Object.entries(entries));
  }

  async read(providerId: string): Promise<Credential | undefined> {
    return this.#entries.get(providerId);
  }

  async list(): Promise<readonly CredentialInfo[]> {
    return [...this.#entries.keys()].map((providerId) => ({ providerId, type: 'api_key' as const }));
  }

  async modify(providerId: string, fn: (current: Credential | undefined) => Promise<Credential | undefined>): Promise<Credential | undefined> {
    const next = await fn(this.#entries.get(providerId));
    if (next === undefined) {
      this.#entries.delete(providerId);
    } else {
      this.#entries.set(providerId, next);
    }
    return next;
  }

  async delete(providerId: string): Promise<void> {
    this.#entries.delete(providerId);
  }
}

export interface PiBackendConfig {
  provider: string;
  modelId: string;
  /** 可选显式 API key（最高优先级）；缺省由 pi-ai 从环境变量解析（OPENAI_API_KEY 等）。凭证不进浏览器。 */
  apiKey?: string;
}

/** 生产接线：按 provider/model 构建 pi-ai complete 函数。 */
export function createPiComplete(config: PiBackendConfig): { complete: PiCompleteFn; label: string } {
  const credentials = config.apiKey === undefined ? undefined : new StaticCredentialStore({ [config.provider]: { type: 'api_key', key: config.apiKey } });
  const models: MutableModels = builtinModels({ credentials });
  const model = models.getModel(config.provider, config.modelId);
  if (model === undefined) {
    throw new Error(`pi-ai 未收录模型 ${config.provider}/${config.modelId}（providers/all 内置目录无此项）`);
  }
  return {
    label: `${config.provider}/${config.modelId}`,
    complete: (context: Context) => models.completeSimple(model, context),
  };
}
