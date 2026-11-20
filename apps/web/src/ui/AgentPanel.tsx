import './AgentPanel.css';
/**
 * 侧边栏统一门店助手对话框：对话流 + 预设提问 + 证据折叠。
 * 优先走 /api/agent（服务端 pi / 本地规则）；API 不可达时降级浏览器内规则解释器。
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@ui-sdk/react/button';
import { Bot, ChartNoAxesCombined, Database, ListChecks, ShieldCheck, Users } from 'lucide-react';
import ContextCards from './beautiful-agent/ContextCards';
import ThinkingState from './beautiful-agent/ThinkingState';
import PromptBar from './beautiful-agent/PromptBar';
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollToEnd,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import type { AgentEvidence, AgentTools } from '@yh/agent/tools';
import { answerLocally, type AgentAnswer } from '@yh/agent/rules';
import type { StoreLayout, TwinSignal, MerchandisingSubmission } from '@yh/contracts';
import {
  askStoreAgent,
  fetchAgentStatus,
  type AgentEngineStatus,
  type StoreAgentAnswer,
} from '../api';

const PRESETS = [
  { icon: ListChecks, title:'优先处理', detail:'先看告警与证据', question:'现在门店哪里最需要我处理？证据是什么？' },
  { icon: ChartNoAxesCombined, title:'收银排队', detail:'解释拥堵与约束', question:'收银区为什么排队？' },
  { icon: Database, title:'数据盲区', detail:'核查缺失与过期信号', question:'哪些区域没数据或信号过期？' },
  { icon: Users, title:'人员支援', detail:'先模拟，再判断可行性', question:'调 3 人支援收银行不行？' },
];

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
  answer?: StoreAgentAnswer;
  asOf?: string;
}

function EvidenceList({ evidence }: { evidence: AgentEvidence[] }) {
  if (evidence.length === 0) return <p className="muted">（本回答无证据引用）</p>;
  const ordered=[...evidence].sort((a,b)=>Number(b.sourceId==='browser-sandbox-placement'||b.metric==='sku_inventory')-Number(a.sourceId==='browser-sandbox-placement'||a.metric==='sku_inventory'));
  return <><ContextCards labels={{header:'依据来源',count:String(evidence.length)}} chunks={ordered.slice(0,6).map((e,i)=>({
    id:`${e.signalId}-${i}`,title:e.metric,chars:e.synthetic?'合成信号':e.kind,source:e.sourceId,badge:e.synthetic?'S':'D',
    body:<><code className="ba-signal-id">{e.signalId}</code><dl className="ba-evidence-fields"><div><dt>来源</dt><dd>{e.sourceId}</dd></div><div><dt>时间</dt><dd>{e.observedAt}</dd></div><div><dt>置信</dt><dd>{e.confidence??'—'}</dd></div><div><dt>类型</dt><dd>{e.kind}</dd></div></dl></>,
  }))}/>
  {evidence.length>6&&<p className="ba-engine-record">先显示 6 条关键证据，共 {evidence.length} 条。</p>}
  <details className="ba-evidence-json"><summary>完整证据 JSON（{evidence.length} 条）</summary><pre>{JSON.stringify(evidence,null,2)}</pre></details></>;

}

function AssistantBubble({ turn }: { turn: ChatTurn }) {
  const answer = turn.answer;
  return (
    <article className="chat-bubble chat-bubble-assistant" aria-label="助手回答">
      <div className="agent-answer-label"><span className="agent-answer-identity"><Bot size={14} aria-hidden="true" />门店助手</span><span>{turn.asOf ? `取数 ${new Date(turn.asOf).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} 北京时间` : '依据提问时场景'}</span></div>
      <div className="answer-text">{turn.text}</div>
      {answer !== undefined && answer.cannotJudge.length > 0 && (
        <div className="cannot-judge">
          <strong>不能判断：</strong>
          <ul>
            {answer.cannotJudge.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {answer !== undefined && (
        <ThinkingState working={false} rows={answer.toolCalls.map((call,index)=>({id:`${call.tool}-${index}`,primary:call.tool,secondary:JSON.stringify(call.args,null,2)}))}>
          <p className="ba-engine-record">{answer.mode==='pi-llm'?`模型 · ${answer.model}`:'回答引擎 · 本地规则'}</p>
          <EvidenceList evidence={answer.evidence}/>
        </ThinkingState>
      )}
    </article>
  );
}

export interface AgentPanelProps {
  tools: AgentTools;
  signals: TwinSignal[];
  layout: StoreLayout;
  at: string;
  merchandisingSubmission?: MerchandisingSubmission;
}

export function AgentPanel({ tools, signals, layout, at, merchandisingSubmission }: AgentPanelProps): React.JSX.Element {
  const requestCounter = useRef(0);
  const requestPending = useRef(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<AgentEngineStatus | null>(null);
  const [transport, setTransport] = useState<'api' | 'local'>('api');
  const busy = turns.some((t) => t.pending);

  useEffect(() => {
    let cancelled = false;
    void fetchAgentStatus().then((s) => {
      if (cancelled) return;
      if (s === null) {
        setTransport('local');
        setStatus({
          ok: true,
          service: 'yh-agent',
          engine: 'rules-local',
          model: 'yh-rules-local-0.1',
          note: 'API 未连接：浏览器内本地规则（离线）',
        });
        return;
      }
      setTransport('api');
      setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ask = async (raw: string): Promise<void> => {
    const q = raw.trim();
    if (q.length === 0 || requestPending.current) return;
    requestPending.current=true;
    const requestId=++requestCounter.current;
    const userId = `u-${requestId}`;
    const assistantId = `a-${requestId}`;
    setQuestion('');
    setTurns((prev) => [
      ...prev,
      { id: userId, role: 'user', text: q },
      { id: assistantId, role: 'assistant', text: '正在查询门店证据…', pending: true },
    ]);

    let answer: StoreAgentAnswer;
    try {
      if (transport === 'api') {
        answer = await askStoreAgent({ question: q, at, layout, signals, merchandising:merchandisingSubmission });
      } else {
        answer = answerLocally(q, tools) as AgentAnswer;
      }
    } catch (error) {
      const fallback = answerLocally(q, tools) as AgentAnswer;
      answer = {
        ...fallback,
        answer: `服务端助手暂不可用，已改用浏览器内本地规则：\n\n${fallback.answer}`,
      };
      setTransport('local');
    }

    requestPending.current=false;
    setTurns((prev) =>
      prev.map((t) =>
        t.id === assistantId
          ? { id: assistantId, role: 'assistant', text: answer.answer, answer, pending: false, asOf: at }
          : t,
      ),
    );
  };

  const engineLabel =
    status === null
      ? '探测引擎…'
      : transport === 'api'
        ? status.engine === 'pi-llm'
          ? `pi · ${status.model}`
          : `服务端本地规则 · ${status.model}`
        : '浏览器本地规则（离线）';

  return (
    <section className={`agent-dialog agent-workspace ${turns.length===0?'ba-home':'ba-conversation'}`} aria-label="门店助手对话框">
      <div className="ba-session-strip">
        <span className="agent-data-badge">合成教学数据</span>
        <details className="ba-session-details"><summary>{engineLabel}</summary><div className="ba-session-popover"><p>{status?.note}</p><p><ShieldCheck size={12} aria-hidden="true"/>建议与推演，不直接执行门店操作</p><p>场景时间 · {at}</p></div></details>
      </div>

      <ScrollArea className="agent-transcript" stickToEnd>
        <ScrollAreaViewport role="log" aria-label="对话记录" tabIndex={0}>
          <ScrollAreaContent>
            {turns.length === 0 ? (
              <div className="chat-empty">
                <div className="agent-empty-heading"><span className="agent-empty-eyebrow">你好，店长</span><h3>今天有什么可以帮你？</h3></div>
                <PromptBar value={question} onChange={setQuestion} onSend={()=>{void ask(question);}} busy={busy}/>
                <p className="ba-suggestion-label">从一个问题开始</p>
                <div className="preset-row" role="group" aria-label="预设提问">
                  {PRESETS.map((p) => (
                    <Button
                      key={p.title}
                      className="preset"
                      disabled={busy}
                      onClick={() => {
                        void ask(p.question);
                      }}
                    >
                      <p.icon className="agent-preset-icon" size={18} strokeWidth={1.7} aria-hidden="true" /><span className="agent-preset-title">{p.title}<span className="agent-preset-detail">{p.detail}</span></span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="chat-turns">
                {turns.map((turn) =>
                  turn.role === 'user' ? (
                    <div key={turn.id} className="chat-bubble chat-bubble-user" aria-label="我的提问">
                      {turn.text}
                    </div>
                  ) : turn.pending ? (
                    <div key={turn.id} className="chat-bubble chat-bubble-assistant chat-pending" aria-busy="true"><ThinkingState working rows={[]}/></div>
                  ) : (
                    <AssistantBubble key={turn.id} turn={turn} />
                  ),
                )}
              </div>
            )}
          </ScrollAreaContent>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical">
          <ScrollAreaThumb />
        </ScrollAreaScrollbar>
        <ScrollAreaScrollToEnd aria-label="跳到最新消息">最新</ScrollAreaScrollToEnd>
      </ScrollArea>

      {turns.length > 0 && <div className="ba-composer-dock"><PromptBar value={question} onChange={setQuestion} onSend={()=>{void ask(question);}} busy={busy}/></div>}
    </section>
  );
}
