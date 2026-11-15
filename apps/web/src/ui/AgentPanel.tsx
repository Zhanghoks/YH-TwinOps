/** Agent 面板：本地规则解释器（离线默认路径），回答带证据引用，数据不足如实说明。 */
import { useState } from 'react';
import type { AgentEvidence, AgentTools } from '@yh/agent/tools';
import { answerLocally, type AgentAnswer } from '@yh/agent/rules';

const PRESETS = [
  '现在门店哪里最需要我处理？证据是什么？',
  'zone-checkout 为什么这么堵？',
  'zone-produce 这个区域为什么没数据？',
  '调 3 人支援收银行不行？',
];

function EvidenceChips({ evidence }: { evidence: AgentEvidence[] }) {
  if (evidence.length === 0) return <div className="muted">（本回答无证据引用）</div>;
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

export function AgentPanel({ tools }: { tools: AgentTools }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);

  const ask = (q: string): void => {
    setQuestion(q);
    setToolError(null);
    // 本地规则路径：确定性意图路由 + 工具调用，无网络请求。
    setAnswer(answerLocally(q, tools));
  };

  return (
    <div className="panel">
      <div className="panel-note">
        回答引擎：<strong>本地规则模式（离线）</strong>——数值全部来自确定性工具调用，无 LLM Key 也可运行；模型意见只能进沙盒，不能改真实系统。
      </div>
      <div className="preset-row">
        {PRESETS.map((p) => (
          <button key={p} className="preset" onClick={() => ask(p)}>
            {p}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim().length > 0) ask(question.trim());
        }}
      >
        <input
          className="agent-input"
          value={question}
          placeholder="向门店助手提问（区域 ID 形如 zone-checkout）"
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className="primary">
          提问
        </button>
      </form>
      {toolError !== null && <div className="alert-box">{toolError}</div>}
      {answer !== null && (
        <div className="answer">
          <div className="answer-text">{answer.answer}</div>
          {answer.cannotJudge.length > 0 && (
            <div className="cannot-judge">
              <strong>不能判断：</strong>
              <ul>
                {answer.cannotJudge.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="tool-calls">
            工具调用：{answer.toolCalls.length === 0 ? '无' : answer.toolCalls.map((c) => c.tool).join('、')}
          </div>
          <EvidenceChips evidence={answer.evidence} />
        </div>
      )}
    </div>
  );
}
