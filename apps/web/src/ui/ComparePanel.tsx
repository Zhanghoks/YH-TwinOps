/** 三方案对比工作台（US-39/40）：同种子仿真 A/B/C，并排展示排队/积压/工时/成本与假设。 */
import { useMemo, useState } from 'react';
import { isDecisionUsable, METRICS, type TwinSnapshot } from '@yh/contracts';
import { checkoutBaseline, TEACHING_WAGE_CNY_PER_HOUR, type CheckoutScenario, type ScenarioStat } from '@yh/simulation';
import type { AgentTools } from '@yh/agent/tools';
import type { ApprovalsClient } from '../api';
import { BeautifulButton } from './beautiful/Button';
import { ReviewHeading, ReviewNotice } from './ReviewTabs';

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
  return (
    <div className="yh-review-stat">
      <span>{label}</span>
      <strong>{stat === undefined ? '—' : <> {stat.mean} <small>{unit}</small></>}</strong>
      {stat !== undefined && <small>±{stat.std} · {stat.min}–{stat.max}</small>}
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
      <section className="yh-review" aria-label="方案对比">
        <ReviewHeading icon="compare" title="方案对比" description="同一模拟条件下比较收银方案" />
        <ReviewNotice tone="warning">无法构建对比：快照缺少收银仿真基线（到达率/服务率/通道数）。请先补采对应信号。</ReviewNotice>
      </section>
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
    <section className="yh-review" aria-label="方案对比">
      <ReviewHeading icon="compare" title="方案对比" description="同一模拟条件下比较收银方案" detail={`种子 ${data.seed}`} />
      <ReviewNotice>{data.note}</ReviewNotice>
      {data.scenarios.map((s) => (
        <article key={s.name} className="yh-review-card">
          <div className="yh-review-card-body">
            <div className="yh-review-card-title">
              <h4>{s.name}</h4>
              <span className="yh-review-tag" data-tone={s.ok ? 'approved' : 'critical'}>{s.ok ? '模拟结果' : '约束拒绝'}</span>
            </div>
            {s.ok ? (
              <>
                <div className="yh-review-stats">
                  <StatLine label="平均排队" stat={s.avgWaitMin} unit="分钟" />
                  <StatLine label="P95 排队" stat={s.p95WaitMin} unit="分钟" />
                  <StatLine label="最大积压" stat={s.maxBacklog} unit="人" />
                </div>
                <dl className="yh-review-kv">
                  <dt>调人工时</dt><dd>{s.extraStaffHours ?? 0} 小时</dd>
                  <dt>成本</dt><dd>{s.extraCostCny == null ? '未核算（未提供时薪假设）' : `${s.extraCostCny} 元（合成教学时薪）`}</dd>
                  <dt>改动次数</dt><dd>{s.laneChangeCount ?? 0}</dd>
                </dl>
              </>
            ) : <ReviewNotice tone="warning">被约束拒绝：{s.why}</ReviewNotice>}
          </div>
          {s.ok && s.name.startsWith('C') && (
            <footer className="yh-review-card-footer">
              <span>创建草案，不会自动批准</span>
              <BeautifulButton type="button" variant="primary" size="sm" onClick={proposeC}>送店长审批</BeautifulButton>
            </footer>
          )}
        </article>
      ))}
      <ReviewNotice>
        假设披露：共享 FIFO 队列 + 指数服务时间（M/M/c 近似）；30 分钟窗口、5 次复制取均值；结果全部为<strong>模拟情景</strong>，不是真实门店预测。
      </ReviewNotice>
      {message !== null && <ReviewNotice tone={message.kind === 'ok' ? 'success' : 'danger'}>{message.text}</ReviewNotice>}
    </section>
  );
}
