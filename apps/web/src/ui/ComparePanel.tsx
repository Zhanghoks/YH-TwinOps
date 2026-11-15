/** 三方案对比工作台（US-39/40）：同种子仿真 A/B/C，并排展示排队/积压/工时/成本与假设。 */
import { useMemo, useState } from 'react';
import { isDecisionUsable, METRICS, type TwinSnapshot } from '@yh/contracts';
import { checkoutBaseline, TEACHING_WAGE_CNY_PER_HOUR, type CheckoutScenario, type ScenarioStat } from '@yh/simulation';
import type { AgentTools } from '@yh/agent/tools';
import type { ApprovalsClient } from '../api';

interface ScenarioRow {
  name: string;
  ok: boolean;
  why?: string;
  avgWaitMin?: ScenarioStat;
  p95WaitMin?: ScenarioStat;
  maxBacklog?: ScenarioStat;
  extraStaffHours?: number;
  extraCostCny?: number | null;
  laneChangeCount?: number;
}

interface CompareData {
  snapshotId: string;
  seed: number;
  scenarios: ScenarioRow[];
  note: string;
}

function compareScenarios(tools: AgentTools, seed: number): CompareData | null {
  const result = tools.compare_scenarios({ seed });
  if (result.status === 'ERROR') return null;
  const data = result.data as {
    snapshotId?: string;
    seed?: number;
    scenarios?: ScenarioRow[];
    note?: string;
  };
  if (data.scenarios === undefined) return null;
  return {
    snapshotId: data.snapshotId ?? '',
    seed: data.seed ?? seed,
    scenarios: data.scenarios,
    note: data.note ?? '',
  };
}

function StatLine({ label, stat, unit }: { label: string; stat?: ScenarioStat; unit: string }): React.JSX.Element {
  if (stat === undefined) return <div className="muted">{label}：—</div>;
  return (
    <div>
      {label}：<strong>{stat.mean}</strong> {unit}
      <span className="muted">
        （±{stat.std}，范围 {stat.min}–{stat.max}）
      </span>
    </div>
  );
}

export function ComparePanel({
  tools,
  snapshot,
  seed,
  client,
  onProposed,
}: {
  tools: AgentTools;
  snapshot: TwinSnapshot;
  seed: number;
  client: ApprovalsClient | null;
  onProposed: (planId: string) => void;
}) {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const data = useMemo(() => compareScenarios(tools, seed), [tools, seed]);

  const lanesOpenNow = useMemo(() => {
    const checkoutZone = Object.values(snapshot.zones).find((z) => z.zoneType === 'CHECKOUT');
    const lanes = checkoutZone?.kpis[METRICS.checkoutLanesOpen];
    if (isDecisionUsable(lanes)) return lanes.value;
    const baseline = checkoutBaseline(snapshot);
    return baseline.ok ? baseline.baseline.totalLanes : 4;
  }, [snapshot]);

  if (data === null) {
    return (
      <div className="panel">
        <div className="panel-note">无法构建对比：快照缺少收银仿真基线（到达率/服务率/通道数）。请先补采对应信号。</div>
      </div>
    );
  }

  const proposeC = (): void => {
    const scenario: CheckoutScenario = {
      name: 'C 调 1 人支援收银',
      lanesOpen: lanesOpenNow,
      extraStaff: 1,
      horizonMin: 30,
      staffWageCnyPerHour: TEACHING_WAGE_CNY_PER_HOUR,
    };
    // Agent 只能生成沙盒草案（US-42）；送审与人审是两步，批准必须由店长在审批页亲自点击。
    const plan = tools.propose_action_plan({ scenarioId: 'sc-C', scenario, seed: data.seed });
    const planData = plan.data as { planId?: string; planStatus?: string };
    if (planData.planId === undefined) {
      setMessage({ kind: 'error', text: '生成审批草案失败：仿真未通过约束校验。' });
      return;
    }
    if (client === null) {
      setMessage({ kind: 'error', text: '审批沙盒尚未就绪，请稍候再试。' });
      return;
    }
    const row = data.scenarios.find((s) => s.name.startsWith('C'));
    client
      .propose({
        planId: planData.planId,
        scenarioId: 'sc-C',
        scenarioName: scenario.name,
        snapshotId: snapshot.snapshotId,
        seed: data.seed,
        summary: {
          avgWaitMean: row?.avgWaitMin?.mean ?? null,
          p95WaitMean: row?.p95WaitMin?.mean ?? null,
          maxBacklogMean: row?.maxBacklog?.mean ?? null,
          extraStaffHours: row?.extraStaffHours ?? 0,
          extraCostCny: row?.extraCostCny ?? null,
          laneChangeCount: row?.laneChangeCount ?? 0,
          note: '模拟情景摘要，非真实预测',
        },
      })
      .then(() => {
        setMessage({ kind: 'ok', text: `审批草案已进入沙盒（${planData.planId}），请到「审批」页亲自批准或驳回。` });
        onProposed(planData.planId ?? '');
      })
      .catch((err: unknown) => {
        setMessage({ kind: 'error', text: `送审失败：${err instanceof Error ? err.message : String(err)}` });
      });
  };

  return (
    <div className="panel">
      <div className="panel-note">{data.note}</div>
      <div className="scenario-cards">
        {data.scenarios.map((s) => (
          <div key={s.name} className={`scenario-card ${s.ok ? '' : 'scenario-rejected'}`}>
            <div className="scenario-title">{s.name}</div>
            {s.ok ? (
              <>
                <StatLine label="平均排队" stat={s.avgWaitMin} unit="分钟" />
                <StatLine label="P95 排队" stat={s.p95WaitMin} unit="分钟" />
                <StatLine label="最大积压" stat={s.maxBacklog} unit="人" />
                <div>
                  调人工时：<strong>{s.extraStaffHours ?? 0}</strong> 小时
                  {s.extraCostCny !== null && s.extraCostCny !== undefined ? (
                    <>
                      ｜成本：<strong>{s.extraCostCny}</strong> 元（合成教学时薪）
                    </>
                  ) : (
                    <span className="muted">｜成本未核算（未提供时薪假设）</span>
                  )}
                </div>
                <div>改动次数：{s.laneChangeCount ?? 0}</div>
                {s.name.startsWith('C') && (
                  <button className="primary" onClick={proposeC}>
                    送店长审批
                  </button>
                )}
              </>
            ) : (
              <div className="muted">被约束拒绝：{s.why}</div>
            )}
          </div>
        ))}
      </div>
      <div className="panel-note">
        假设披露：共享 FIFO 队列 + 指数服务时间（M/M/c 近似）；30 分钟窗口、5 次复制取均值；结果全部为<strong>模拟情景</strong>，不是真实门店预测。
      </div>
      {message !== null && <div className={message.kind === 'ok' ? 'ok-box' : 'alert-box'}>{message.text}</div>}
    </div>
  );
}
