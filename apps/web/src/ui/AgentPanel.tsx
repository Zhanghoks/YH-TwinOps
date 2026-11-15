/**
 * 侧边栏统一门店助手对话框：对话流 + 预设提问 + 证据折叠。
 * 优先走 /api/agent（服务端 pi / 本地规则）；API 不可达时降级浏览器内规则解释器。
 */
import { useEffect, useId, useState } from 'react';
import { Button } from '@ui-sdk/react/button';
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from '@ui-sdk/react/collapsible';
import { Field, FieldDescription, FieldLabel } from '@ui-sdk/react/field';
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollToEnd,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import { Textarea } from '@ui-sdk/react/textarea';
import type { AgentEvidence, AgentTools } from '@yh/agent/tools';
import { answerLocally, type AgentAnswer } from '@yh/agent/rules';
import type { StoreLayout, TwinSignal } from '@yh/contracts';
import {
  askStoreAgent,
  fetchAgentStatus,
  type AgentEngineStatus,
  type StoreAgentAnswer,
} from '../api';

const PRESETS = [
  '现在门店哪里最需要我处理？证据是什么？',
  'zone-checkout 为什么这么堵？',
  'zone-produce 这个区域为什么没数据？',
  '调 3 人支援收银行不行？',
];

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
  answer?: StoreAgentAnswer;
}

function EvidenceList({ evidence }: { evidence: AgentEvidence[] }) {
  if (evidence.length === 0) return <p className="muted">（本回答无证据引用）</p>;
  return (
    <ul className="evidence-list">
      {evidence.map((e, i) => (
        <li key={`${e.signalId}-${i}`} className="evidence-chip">
          <code>{e.signalId}</code> {e.metric} @ {e.observedAt} · 来源 {e.sourceId} · {e.kind}
          {e.synthetic ? ' · 合成' : ''} · 置信 {e.confidence ?? '—'}
        </li>
      ))}
    </ul>
  );
}

function AssistantBubble({ turn }: { turn: ChatTurn }) {
  const answer = turn.answer;
  return (
    <article className="chat-bubble chat-bubble-assistant" aria-label="助手回答">
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
        <Collapsible className="agent-collapsible" defaultOpen={false}>
          <CollapsibleTrigger aria-label="展开证据与工具轨迹">
            证据与工具轨迹
            {answer.mode === 'pi-llm' ? ` · ${answer.model}` : ' · 本地规则'}
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <p className="tool-calls">
              工具调用：
              {answer.toolCalls.length === 0 ? '无' : answer.toolCalls.map((c) => c.tool).join('、')}
            </p>
            <EvidenceList evidence={answer.evidence} />
          </CollapsiblePanel>
        </Collapsible>
      )}
    </article>
  );
}

export interface AgentPanelProps {
  tools: AgentTools;
  signals: TwinSignal[];
  layout: StoreLayout;
  at: string;
}

export function AgentPanel({ tools, signals, layout, at }: AgentPanelProps): React.JSX.Element {
  const formId = useId();
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
    if (q.length === 0 || busy) return;
    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;
    setQuestion('');
    setTurns((prev) => [
      ...prev,
      { id: userId, role: 'user', text: q },
      { id: assistantId, role: 'assistant', text: '正在查询门店证据…', pending: true },
    ]);

    let answer: StoreAgentAnswer;
    try {
      if (transport === 'api') {
        answer = await askStoreAgent({ question: q, at, layout, signals });
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

    setTurns((prev) =>
      prev.map((t) =>
        t.id === assistantId
          ? { id: assistantId, role: 'assistant', text: answer.answer, answer, pending: false }
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
    <section className="agent-dialog" aria-label="门店助手对话框">
      <header className="agent-dialog-head agent-dialog-head-embedded">
        <p className="panel-note">
          {status?.note ?? '回答带证据引用；数据不足如实说明；模型意见只能进沙盒。'}
        </p>
        <span className="agent-engine-chip" title={status?.note}>
          {engineLabel}
        </span>
      </header>

      <ScrollArea className="agent-transcript" stickToEnd>
        <ScrollAreaViewport role="log" aria-label="对话记录" tabIndex={0}>
          <ScrollAreaContent>
            {turns.length === 0 ? (
              <div className="chat-empty">
                <p>向助手提问高峰运营问题。数值来自确定性工具，不会编造。</p>
                <div className="preset-row" role="group" aria-label="预设提问">
                  {PRESETS.map((p) => (
                    <Button
                      key={p}
                      className="preset"
                      disabled={busy}
                      onClick={() => {
                        void ask(p);
                      }}
                    >
                      {p}
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
                    <div key={turn.id} className="chat-bubble chat-bubble-assistant chat-pending" aria-busy="true">
                      {turn.text}
                    </div>
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

      {turns.length > 0 && (
        <div className="preset-row preset-row-compact" role="group" aria-label="继续提问预设">
          {PRESETS.map((p) => (
            <Button
              key={p}
              className="preset"
              disabled={busy}
              onClick={() => {
                void ask(p);
              }}
            >
              {p}
            </Button>
          ))}
        </div>
      )}

      <form
        id={formId}
        className="agent-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <Field name="agent-question" className="agent-field">
          <FieldLabel>向门店助手提问</FieldLabel>
          <Textarea
            className="agent-input"
            value={question}
            autoResize
            rows={2}
            placeholder="例如：zone-checkout 为什么这么堵？"
            disabled={busy}
            onValueChange={(value) => setQuestion(value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void ask(question);
              }
            }}
          />
          <FieldDescription>区域 ID 形如 zone-checkout。Enter 发送，Shift+Enter 换行。</FieldDescription>
        </Field>
        <Button type="submit" className="primary" disabled={busy || question.trim().length === 0} pendingAnnouncement="正在提问">
          提问
        </Button>
      </form>
    </section>
  );
}
