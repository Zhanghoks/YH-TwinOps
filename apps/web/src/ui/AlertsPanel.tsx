/** 告警中心（US-25/26）：红色预警只来自规则与模型指标，每条带触发原因与证据引用。 */
import { isDecisionUsable, type TwinSnapshot } from '@yh/contracts';
import { useWorkbench } from '../state';

export function AlertsPanel({ snapshot }: { snapshot: TwinSnapshot }) {
  const select = useWorkbench((s) => s.select);
  if (snapshot.alerts.length === 0) {
    return <div className="panel">当前无告警（规则阈值内）。</div>;
  }
  return (
    <div className="panel">
      {snapshot.alerts.map((a) => {
        const zone = snapshot.zones[a.zoneId];
        const metric = zone?.kpis[a.metric];
        const value = isDecisionUsable(metric) ? metric.value : null;
        return (
          <div key={a.alertId} className={`alert-card severity-${a.severity.toLowerCase()}`}>
            <div className="alert-head">
              <span className={`chip severity-${a.severity.toLowerCase()}`}>{a.severity}</span>
              <strong>{a.reason}</strong>
            </div>
            <button
              className="link"
              onClick={() => {
                select({ kind: 'zone', id: a.zoneId });
              }}
            >
              定位分区 {a.zoneId}
            </button>
            <div className="muted">
              规则：{a.rule}
              {value !== null ? ` · 当前值 ${value}` : ' · 当前值不可用于决策'}
              {' '}· 建议处理人：{a.suggestedRole} · 触发 {a.raisedAt.replace('T', ' ').replace('Z', '')}
            </div>
            <div className="muted">
              证据：{a.evidenceIds.map((id) => (
                <code key={id}>{id}</code>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
