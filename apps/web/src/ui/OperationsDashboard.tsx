import { useId, useState } from 'react';
import { Button } from '@ui-sdk/react/button';
import { SegmentedControl, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
import type { LiveOperatingScenario } from '../operatingClock';
import type { OperatingScenario } from '../operatingModel';
import './OperationsDashboard.css';

interface OperationsDashboardProps {
  scenario: OperatingScenario;
  followClock?: boolean;
  onResumeClock?: () => void;
  onDayChange: (day: 'weekday' | 'weekend') => void;
  onHourChange: (hour: number) => void;
  incidentMode: boolean;
  onIncidentModeChange: (enabled: boolean) => void;
}

const integer = new Intl.NumberFormat('zh-CN');
const money = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const yuans = (cents: number) => money.format(cents / 100);

export function OperationsDashboard({
  scenario, onDayChange, onHourChange, incidentMode, onIncidentModeChange, followClock = false, onResumeClock,
}: OperationsDashboardProps) {
  const [expanded, setExpanded] = useState(false);
  const live = 'mode' in scenario && scenario.mode === 'live' ? scenario as LiveOperatingScenario : undefined;
  const detailsId = useId();
  const headingId = useId();

  function switchMode() {
    setExpanded(false);
    onIncidentModeChange(!incidentMode);
  }

  return <section className="ops-dashboard" aria-labelledby={headingId}>
    <header className="ops-header">
      <div className="ops-heading">
        <h2 id={headingId}>门店运营驾驶舱</h2>
        <span className="ops-chip">合成模拟 · 非真实监测</span>
        {!incidentMode && <span className="ops-source">{scenario.date} · 北京时间（UTC+8）</span>}
      </div>
      <div className="ops-controls">
        {!incidentMode && <>
          <span className="ops-clock-status" role="status">{followClock && live ? `${String(Math.floor(live.minuteOfDay / 60)).padStart(2,'0')}:${String(live.minuteOfDay % 60).padStart(2,'0')} 随钟模拟 · ${live.status === 'preopen' ? '营业前' : live.status === 'closed' ? '已闭店' : '营业中'}` : '手动回看 · 完整小时情景'}</span>
          {onResumeClock && !followClock && <Button onClick={onResumeClock}>返回随钟模拟</Button>}
          <SegmentedControl aria-label="模拟日期类型" value={scenario.day} onValueChange={value => {
            if (value === 'weekday' || value === 'weekend') onDayChange(value);
          }}>
            <SegmentedControlItem value="weekday">工作日</SegmentedControlItem>
            <SegmentedControlItem value="weekend">周末</SegmentedControlItem>
          </SegmentedControl>
          <label>时段 <select aria-label="经营模拟时段" value={scenario.hour} onChange={e => onHourChange(Number(e.currentTarget.value))}>
            {scenario.series.map(row => <option key={row.hour} value={row.hour}>{hourLabel(row.hour)}–{hourLabel(row.hour + 1)}</option>)}
          </select></label>
          <Button aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(open => !open)}>
            {expanded ? '收起经营明细' : '展开经营明细'}
          </Button>
        </>}
        <Button onClick={switchMode}>{incidentMode ? '返回经营模拟' : '进入异常教学情景'}</Button>
      </div>
    </header>
    {incidentMode
      ? <p className="ops-incident">当前 3D 与门店助手使用独立的异常教学信号；经营模拟数据未应用。</p>
      : <OperatingReadout scenario={scenario} expanded={expanded} detailsId={detailsId} />}
  </section>;
}

function OperatingReadout({ scenario, expanded, detailsId }: {
  scenario: OperatingScenario; expanded: boolean; detailsId: string;
}) {
  const { current, series, daily, zones, checkouts, inventory } = scenario;
  const live = 'mode' in scenario && scenario.mode === 'live' ? scenario as LiveOperatingScenario : undefined;
  const totals = live?.cumulative ?? current;
  const maxEntrants = Math.max(1, ...series.map(row => row.entrants));
  const peak = series.reduce((a, b) => a.entrants >= b.entrants ? a : b, current);
  return <>
    <div className="ops-overview">
      <dl className="ops-kpis" aria-label={live ? '今日截至当前分钟经营指标' : '所选小时经营指标'}>
        <div><dt>{live ? '今日累计销售' : '时段销售额'}</dt><dd><small>¥</small>{yuans(totals.revenueCents)}</dd></div>
        <div><dt>{live ? '今日累计进店' : '时段进店'}</dt><dd>{integer.format(totals.entrants)}<small>人</small></dd></div>
        <div><dt>{live ? '今日累计成交' : '时段成交'}</dt><dd>{integer.format(totals.transactions)}<small>单</small></dd></div>
        <div><dt>小票 / 进店比</dt><dd>{(totals.conversion * 100).toFixed(1)}<small>%</small></dd></div>
        <div><dt>客单价</dt><dd><small>¥</small>{yuans(totals.basketCents)}</dd></div>
        <div><dt>{live ? '模拟在场估算' : '平均在场估算'}</dt><dd>{integer.format(current.occupancy)}<small>人</small></dd></div>
      </dl>
      <div className="ops-trend">
        <div><strong>全天进店预测</strong><span>峰值 {hourLabel(peak.hour)} · {peak.entrants} 人</span></div>
        <div>
          <svg viewBox="0 0 196 42" preserveAspectRatio="none" role="img" aria-label={`分时进店人数：${series.map(row => `${hourLabel(row.hour)} ${row.entrants} 人`).join('，')}`}>
            {series.map((row, i) => {
              const height = row.entrants / maxEntrants * 38;
              return <rect key={row.hour} className={row.hour === current.hour ? 'is-current' : undefined}
                x={i * 14 + 1} y={42 - height} width="10" height={height} rx="1.5">
                <title>{hourLabel(row.hour)}–{hourLabel(row.hour + 1)}：{row.entrants} 人</title>
              </rect>;
            })}
          </svg>
          <div className="ops-chart-labels" aria-hidden="true"><span>08:00</span><span>15:00</span><span>22:00</span></div>
        </div>
      </div>
    </div>
    {live && <p className="ops-note">截至 {String(Math.floor(live.minuteOfDay / 60)).padStart(2,'0')}:{String(live.minuteOfDay % 60).padStart(2,'0')} 的合成累计；{live.status === 'open' ? `当前小时已模拟 ${live.elapsedMinutes} 分钟，未到时间不计入累计。` : live.status === 'preopen' ? '08:00 开始模拟，当前累计与在场/队列为零。' : '22:00 已完成当日营业模拟，在场和队列已归零。'} 手动选小时可回看，返回随钟模拟恢复自动推进。</p>}
    <p className="ops-note">全日预测：{integer.format(daily.entrants)} 人进店 · {integer.format(daily.transactions)} 单 · ¥{yuans(daily.revenueCents)}。来源：{scenario.provenance}。</p>
    {expanded && <div id={detailsId} className="ops-details">
      <section aria-label="分区经营明细">
        <h3>分区经营</h3><p className="ops-note">在场人数为合成估算，对应 3D 热度，非时点观测；不同于助手的最近 15 分钟分区进店分配。</p>
        <table aria-label="分区经营数据">
          <thead><tr><th scope="col">分区</th><th scope="col">{live ? '模拟在场估算' : '平均在场估算'}</th><th scope="col">停留 (分)</th><th scope="col">时段销售 (元)</th></tr></thead>
          <tbody>{zones.map(zone => <tr key={zone.zoneId}>
            <th scope="row">{zone.name}</th><td>{zone.occupancy}</td><td>{zone.averageDwellMin.toFixed(1)}</td><td>{yuans(zone.revenueCents)}</td>
          </tr>)}</tbody>
        </table>
      </section>
      <section aria-label="收银经营明细">
        <h3>收银排队</h3>
        <table aria-label="收银数据">
          <thead><tr><th scope="col">收银区</th><th scope="col">开放</th><th scope="col">排队 (人)</th><th scope="col">等待 (分)</th></tr></thead>
          <tbody>{checkouts.map(row => <tr key={row.zoneId}>
            <th scope="row">{row.name}</th><td>{row.lanesOpen}</td><td>{row.queueLength}</td><td>{row.waitMin.toFixed(1)}</td>
          </tr>)}</tbody>
        </table>
        <p className="ops-note">开放通道、队列与等待是该时段的点位模拟。</p>
      </section>
      <section aria-label="库存经营明细">
        <h3>样本 SKU 库存补货</h3><p className="ops-note">仅 5 个样本 SKU，线性消耗预算；未模拟后仓、补货入库，不代表全店库存。</p>
        <table aria-label="库存预警数据">
          <thead><tr><th scope="col">商品</th><th scope="col">库存 / 阈值</th><th scope="col">建议补货</th><th scope="col">状态</th></tr></thead>
          <tbody>{[...inventory].sort((a, b) => Number(a.status === 'normal') - Number(b.status === 'normal')).map(row => <tr key={row.sku}>
            <th scope="row" title={row.sku}>{row.name}</th>
            <td>{row.onHand} / {row.reorderPoint} {row.unit}</td><td>{row.suggestedOrder} {row.unit}</td>
            <td className={row.status === 'normal' ? undefined : 'ops-alert'}>{row.status === 'out' ? '缺货' : row.status === 'low' ? '低库存' : '正常'}</td>
          </tr>)}</tbody>
        </table>
      </section>
    </div>}
  </>;
}
