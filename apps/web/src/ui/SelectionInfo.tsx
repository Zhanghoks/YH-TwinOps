/** 选中详情：分区 KPI / 设施语义信息；无数据时如实显示，绝不补假数（US-14、AT-03）。 */
import type { TwinSnapshot } from '@yh/contracts';
import { LocateFixed } from 'lucide-react';
import { BeautifulButton } from './beautiful/Button';
import './ReviewTabs.css';
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
    <span className="yh-review-tag" data-tone={stale ? 'stale' : kind.toLowerCase()}>
      {stale ? 'STALE' : kind}
    </span>
  );
}

export function SelectionInfo({ snapshot }: { snapshot: TwinSnapshot }) {
  const selection = useWorkbench((s) => s.selection);
  const select = useWorkbench((s) => s.select);
  if (selection === null) {
    return (
      <p className="yh-selection-hint"><LocateFixed size={14} aria-hidden="true" />点击场景中的分区或设施查看语义数据；空白处点击取消选择。</p>
    );
  }
  if (selection.kind === 'fixture') {
    const fixture = layout.fixtures.find((f) => f.fixtureId === selection.id);
    if (fixture === undefined) return null;
    const zone = snapshot.zones[fixture.zoneId];
    const fixtureState = zone?.fixtures[fixture.fixtureId];
    return (
      <div className="yh-selection">
        <div className="yh-review-card-title">
          <strong>设施 {fixture.fixtureId}</strong>
          <BeautifulButton type="button" variant="quiet" size="xs" onClick={() => select(null)}>
            取消选择
          </BeautifulButton>
        </div>
        <dl className="yh-review-kv">
          <dt>分区</dt>
          <dd>
            {fixture.zoneId}（{zone?.zoneType ?? '—'}）
          </dd>
          <dt>类型</dt>
          <dd>{fixture.fixtureType}</dd>
          <dt>资产</dt>
          <dd>
            <code>{fixture.assetId}</code>
          </dd>
          <dt>尺寸</dt>
          <dd>
            {fixture.widthM} × {fixture.depthM} × {fixture.heightM} m（教学假设）
          </dd>
          <dt>容量</dt>
          <dd>{fixture.capacity ?? '—'}</dd>
        </dl>
        {fixtureState !== undefined && Object.keys(fixtureState.kpis).length > 0 && (
          <>
            <h4>设施级读数</h4>
            {Object.values(fixtureState.kpis).map((k) => (
              <div key={k.metric} className="yh-selection-kpi">
                {METRIC_LABELS[k.metric] ?? k.metric}：<strong>{k.value ?? '无数据'}</strong> {k.unit} <KindBadge kind={k.kind} stale={k.stale} />
              </div>
            ))}
          </>
        )}
        {fixtureState !== undefined && Object.keys(fixtureState.kpis).length === 0 && <div className="yh-review-text-muted">该设施暂无关联时序数据（无数据，如实显示）。</div>}
      </div>
    );
  }

  const zone = snapshot.zones[selection.id];
  if (zone === undefined) return null;
  const meta = layout.zones.find((z) => z.zoneId === selection.id);
  const kpis = Object.values(zone.kpis);
  return (
    <div className="yh-selection">
      <div className="yh-review-card-title">
        <strong>
          分区 {selection.id}（{meta?.name ?? zone.zoneType}）
        </strong>
        <BeautifulButton type="button" variant="quiet" size="xs" onClick={() => select(null)}>
          取消选择
        </BeautifulButton>
      </div>
      <dl className="yh-review-kv">
        <dt>信号总数</dt>
        <dd>{zone.coverage.totalSignals}</dd>
        <dt>UNKNOWN</dt>
        <dd>{zone.coverage.unknownCount}</dd>
        <dt>过期</dt>
        <dd>{zone.coverage.staleCount}</dd>
        <dt>最新观测</dt>
        <dd>{zone.coverage.lastObservedAt ?? '无'}</dd>
      </dl>
      {kpis.length === 0 && <div className="yh-review-text-muted">该分区暂无任何信号（无数据，如实显示）。</div>}
      {kpis.map((k) => (
        <div key={k.metric} className="yh-selection-kpi">
          {METRIC_LABELS[k.metric] ?? k.metric}：<strong>{k.value ?? '无数据'}</strong> {k.unit} <KindBadge kind={k.kind} stale={k.stale} />
          <span className="yh-review-text-muted">
            {' '}
            @ {k.observedAt.replace('T', ' ').replace('Z', '')} · 证据 {k.evidenceIds.join('、') || '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
