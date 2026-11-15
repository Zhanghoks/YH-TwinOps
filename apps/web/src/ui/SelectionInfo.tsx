/** 选中详情：分区 KPI / 设施语义信息；无数据时如实显示，绝不补假数（US-14、AT-03）。 */
import { isDecisionUsable, type TwinSnapshot } from '@yh/contracts';
import { layout } from '../data';
import { useWorkbench } from '../state';

const METRIC_LABELS: Record<string, string> = {
  sales_amount: '销售额',
  traffic_count: '客流',
  queue_length: '队列长度',
  queue_wait_min: '排队等待',
  checkout_service_rate_per_lane_per_min: '单通道服务率',
  checkout_arrivals_per_min: '到达率',
  checkout_lanes_open: '开放通道',
  stock_level: '库存',
  equipment_temp_c: '设备温度',
  equipment_online: '设备在线',
  staff_count: '在岗员工',
  checkout_qualified_staff_count: '持收银资格人数',
};

function KindBadge({ kind, stale }: { kind: string; stale: boolean }): React.JSX.Element {
  return (
    <span className={`chip kind-${kind.toLowerCase()} ${stale ? 'kind-stale' : ''}`}>
      {stale ? 'STALE' : kind}
    </span>
  );
}

export function SelectionInfo({ snapshot }: { snapshot: TwinSnapshot }) {
  const selection = useWorkbench((s) => s.selection);
  const select = useWorkbench((s) => s.select);
  if (selection === null) {
    return (
      <div className="panel-note">
        点击场景中的分区或设施查看语义数据；空白处点击取消选择。
      </div>
    );
  }
  if (selection.kind === 'fixture') {
    const fixture = layout.fixtures.find((f) => f.fixtureId === selection.id);
    if (fixture === undefined) return null;
    const zone = snapshot.zones[fixture.zoneId];
    const fixtureState = zone?.fixtures[fixture.fixtureId];
    return (
      <div className="panel">
        <div className="approval-head">
          <strong>设施 {fixture.fixtureId}</strong>
          <button className="link" onClick={() => select(null)}>
            取消选择
          </button>
        </div>
        <div className="kv">
          <span>分区</span>
          <span>
            {fixture.zoneId}（{zone?.zoneType ?? '—'}）
          </span>
          <span>类型</span>
          <span>{fixture.fixtureType}</span>
          <span>资产</span>
          <span>
            <code>{fixture.assetId}</code>
          </span>
          <span>尺寸</span>
          <span>
            {fixture.widthM} × {fixture.depthM} × {fixture.heightM} m（教学假设）
          </span>
          <span>容量</span>
          <span>{fixture.capacity ?? '—'}</span>
        </div>
        {fixtureState !== undefined && Object.keys(fixtureState.kpis).length > 0 && (
          <>
            <h4>设施级读数</h4>
            {Object.values(fixtureState.kpis).map((k) => (
              <div key={k.metric} className="kpi-row">
                {METRIC_LABELS[k.metric] ?? k.metric}：<strong>{k.value ?? '无数据'}</strong> {k.unit} <KindBadge kind={k.kind} stale={k.stale} />
              </div>
            ))}
          </>
        )}
        {fixtureState !== undefined && Object.keys(fixtureState.kpis).length === 0 && <div className="muted">该设施暂无关联时序数据（无数据，如实显示）。</div>}
      </div>
    );
  }

  const zone = snapshot.zones[selection.id];
  if (zone === undefined) return null;
  const meta = layout.zones.find((z) => z.zoneId === selection.id);
  const kpis = Object.values(zone.kpis);
  return (
    <div className="panel">
      <div className="approval-head">
        <strong>
          分区 {selection.id}（{meta?.name ?? zone.zoneType}）
        </strong>
        <button className="link" onClick={() => select(null)}>
          取消选择
        </button>
      </div>
      <div className="kv">
        <span>信号总数</span>
        <span>{zone.coverage.totalSignals}</span>
        <span>UNKNOWN</span>
        <span>{zone.coverage.unknownCount}</span>
        <span>过期</span>
        <span>{zone.coverage.staleCount}</span>
        <span>最新观测</span>
        <span>{zone.coverage.lastObservedAt ?? '无'}</span>
      </div>
      {kpis.length === 0 && <div className="muted">该分区暂无任何信号（无数据，如实显示）。</div>}
      {kpis.map((k) => (
        <div key={k.metric} className="kpi-row">
          {METRIC_LABELS[k.metric] ?? k.metric}：<strong>{k.value ?? '无数据'}</strong> {k.unit} <KindBadge kind={k.kind} stale={k.stale} />
          <span className="muted">
            {' '}
            @ {k.observedAt.replace('T', ' ').replace('Z', '')} · 证据 {k.evidenceIds.join('、') || '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
