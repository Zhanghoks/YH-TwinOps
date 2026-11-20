/** 告警中心（US-25/26）：红色预警只来自规则与模型指标，每条带触发原因与证据引用。 */
import { LocateFixed } from 'lucide-react';
import { isDecisionUsable, type TwinSnapshot } from '@yh/contracts';
import { useWorkbench } from '../state';
import { BeautifulButton } from './beautiful/Button';
import { ReviewHeading, ReviewNotice } from './ReviewTabs';

export function AlertsPanel({ snapshot }: { snapshot: TwinSnapshot }) {
  const select = useWorkbench((s) => s.select);
  return (
    <section className="yh-review" aria-label="告警中心">
      <ReviewHeading icon="alerts" title="告警中心" description="规则触发 · 证据可追溯" detail={`${snapshot.alerts.length} 条`} />
      {snapshot.alerts.length === 0 && <ReviewNotice>当前无告警（规则阈值内）。</ReviewNotice>}
      {snapshot.alerts.map((a) => {
        const zone = snapshot.zones[a.zoneId];
        const metric = zone?.kpis[a.metric];
        const value = isDecisionUsable(metric) ? metric.value : null;
        const severity = a.severity.toLowerCase();
        return (
          <article key={a.alertId} className="yh-review-card">
            <div className="yh-review-card-body">
              <div className="yh-review-card-title">
                <h4>{a.reason}</h4>
                <span className="yh-review-tag" data-tone={severity}>{a.severity}</span>
              </div>
              <dl className="yh-review-kv">
                <dt>规则</dt><dd>{a.rule}</dd>
                <dt>当前值</dt><dd>{value ?? '不可用于决策'}</dd>
                <dt>建议处理人</dt><dd>{a.suggestedRole}</dd>
                <dt>触发</dt><dd><time dateTime={a.raisedAt}>{a.raisedAt.replace('T', ' ').replace('Z', ' UTC')}</time></dd>
              </dl>
              <div className="yh-review-refs">证据 {a.evidenceIds.length === 0 ? '—' : a.evidenceIds.map((id) => <code key={id}>{id}</code>)}</div>
            </div>
            <div className="yh-review-card-footer">
              <BeautifulButton type="button" size="sm" variant="secondary" onClick={() => select({ kind: 'zone', id: a.zoneId })}>
                <LocateFixed size={13} aria-hidden="true" />定位分区 {a.zoneId}
              </BeautifulButton>
            </div>
          </article>
        );
      })}
    </section>
  );
}
