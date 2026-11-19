import { useId, useState } from 'react';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
import { buildOperatingScenario, type OperatingHour, type OperatingScenario } from '../operatingModel';
import type { LiveOperatingScenario } from '../operatingClock';
import './OperatingAnalytics.css';

type Props = { scenario: OperatingScenario; onHourChange: (hour: number) => void };
const isLive = (scenario: OperatingScenario): scenario is LiveOperatingScenario =>
  'mode' in scenario && scenario.mode === 'live';
type Metric = 'entrants' | 'transactions' | 'revenueCents';

const number = new Intl.NumberFormat('zh-CN');
const amount = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });
const time = (hour: number) => String(hour).padStart(2, '0') + ':00';
const minuteTime = (minuteOfDay: number) =>
  String(Math.floor(minuteOfDay / 60)).padStart(2, '0') + ':' + String(minuteOfDay % 60).padStart(2, '0');
const span = (hour: number) => time(hour) + '–' + time(hour + 1);
const short = (name: string) => name.split(' / ')[0];
const labels = { entrants: '进店', transactions: '成交', revenueCents: '销售额' };
const units = { entrants: '人', transactions: '单', revenueCents: '万元' };
const colors = { entrants: '#236f58', transactions: '#42678c', revenueCents: '#84613c' };
const inventoryRank = { out: 0, low: 1, normal: 2 };

function MetricPlot({ metric, series, scaleSeries, selected, onHourChange, live }: {
  metric: Metric; series: OperatingHour[]; scaleSeries: OperatingHour[];
  selected: OperatingHour; onHourChange: (hour: number) => void; live?: LiveOperatingScenario;
}) {
  const titleId = useId();
  const sales = metric === 'revenueCents';
  // One zero-based axis per metric; the limits cover both date types to support comparison.
  const step = sales ? 1_000_000 : 100;
  const max = Math.max(step, Math.ceil(Math.max(...scaleSeries.map(row => row[metric])) / step) * step);
  const ticks = [max, max / 2, 0];
  const display = (v: number) => sales ? String(v / 1_000_000) : number.format(v);
  const count = series.length;
  const x = (i: number) => (i + .5) * 560 / count;
  const y = (v: number) => 94 - 88 * v / max;
  const index = series.findIndex(row => row.hour === selected.hour);
  const activeX = x(index), activeY = y(selected[metric]);
  const chartValue = (row: OperatingHour) => sales ? amount.format(row[metric] / 100) : `${number.format(row[metric])} ${units[metric]}`;
  const complete = (row: OperatingHour) => !!live && (row.hour + 1) * 60 <= live.minuteOfDay;
  const started = (row: OperatingHour) => !!live && row.hour * 60 <= live.minuteOfDay;
  const actual = (row: OperatingHour) => live?.actualSeries.find(item => item.hour === row.hour)
    ?? (live?.status === 'open' && row.hour === selected.hour ? selected : undefined);
  const finished = series.flatMap((row, i) => {
    const completedRow = complete(row) ? actual(row) : undefined;
    return completedRow ? [{ row: completedRow, i }] : [];
  });
  const upcoming = series.flatMap((row, i) => live && !complete(row) ? [{ row, i }] : []);
  const currentText = live?.status === 'preopen' ? '尚未开店'
    : live?.status === 'closed' ? `末时段 · ${chartValue(selected)}`
    : chartValue(selected);
  const points = (rows: { row: OperatingHour; i: number }[]) => rows.map(({row, i}) => `${x(i)},${y(row[metric])}`).join(' ');
  const tooltipFor = (row: OperatingHour) => {
    if (!live) return `${span(row.hour)}，${labels[metric]} ${chartValue(row)}`;
    const actualRow = actual(row);
    if (complete(row)) return `${span(row.hour)}，已完成模拟${labels[metric]} ${actualRow ? chartValue(actualRow) : '暂无数据'}；切换至手动回看`;
    if (started(row) && actualRow) return `${span(row.hour)}，进行中模拟${labels[metric]} ${chartValue(actualRow)}；整点预测 ${chartValue(row)}；切换至手动回看`;
    return `${span(row.hour)}，未开始，${labels[metric]}预测 ${chartValue(row)}；切换至手动整点情景`;
  };

  return <figure className="an-plot" aria-labelledby={titleId}>
    <figcaption id={titleId}><span>{labels[metric]} <small>{units[metric]}/小时</small></span>
      <strong>{currentText}</strong>
    </figcaption>
    <div className="an-plot-grid">
      <div className="an-axis" aria-hidden="true">{ticks.map(tick => <span key={tick}>{display(tick)}</span>)}</div>
      <div className="an-plot-canvas">
        <svg viewBox="0 0 560 100" preserveAspectRatio="none" aria-hidden="true">
          {live?.status !== 'preopen' && <rect x={activeX - 280 / count} width={560 / count} height="100" fill="#e9f2ed"/>}
          {ticks.map(tick => <line key={tick} x1="0" x2="560" y1={y(tick)} y2={y(tick)} className="an-gridline"/>)}
          {live ? <>
            {sales ? series.map((row, i) => {
              const actualRow = actual(row);
              return <g key={row.hour}>
                {!complete(row) && <rect className="an-forecast-mark" x={x(i) - 10} width="20" y={y(row[metric])} height={94 - y(row[metric])}
                  rx="2" fill="none" stroke={colors[metric]} strokeDasharray="3 2" vectorEffect="non-scaling-stroke"/>}
                {actualRow && <rect x={x(i) - 10} width="20" y={y(actualRow[metric])} height={94 - y(actualRow[metric])}
                  rx="2" fill={row.hour === selected.hour ? colors[metric] : '#b49978'}/>}
              </g>;
            }) : <>
              <polyline points={points(upcoming)} className="an-forecast-mark" fill="none"
                stroke={colors[metric]} strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke"/>
              {upcoming.map(({row, i}) => <circle key={row.hour} className="an-forecast-mark" cx={x(i)} cy={y(row[metric])} r="2.5" fill={colors[metric]}/>)}
              <polyline points={points(finished)} fill="none" stroke={colors[metric]} strokeWidth="2" vectorEffect="non-scaling-stroke"/>
              {finished.map(({row, i}) => <circle key={row.hour} cx={x(i)} cy={y(row[metric])} r="2" fill={colors[metric]}/>)}
              {live.status === 'open' && <circle cx={activeX} cy={activeY} r="4" fill="white" stroke={colors[metric]} strokeWidth="2" vectorEffect="non-scaling-stroke"/>}
            </>}
          </> : <>
            {sales
              ? series.map((row, i) => <rect key={row.hour} x={x(i) - 10} width="20" y={y(row[metric])}
                height={94 - y(row[metric])} rx="2" fill={row.hour === selected.hour ? colors[metric] : '#c2aa8c'}/>)
              : <polyline points={points(series.map((row, i) => ({row, i})))} fill="none" stroke={colors[metric]} strokeWidth="2" vectorEffect="non-scaling-stroke"/>}
            {!sales && <circle cx={activeX} cy={activeY} r="4" fill={colors[metric]}/>}
          </>}
        </svg>
        <div className="an-hour-targets" role="group" aria-label={`${labels[metric]}图表时段`}
          style={{ gridTemplateColumns: `repeat(${count}, minmax(0,1fr))` }}>
          {series.map((row, i) => <button type="button" key={row.hour} aria-pressed={row.hour === selected.hour}
            aria-label={tooltipFor(row)} title={tooltipFor(row)}
            tabIndex={row.hour === selected.hour ? 0 : -1} onClick={() => onHourChange(row.hour)}
            onKeyDown={e => {
              const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1
                : e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : undefined;
              if (next === undefined) return;
              e.preventDefault();
              const target = Math.max(0, Math.min(count - 1, next));
              const targetRow = series[target];
              if (!targetRow) return;
              onHourChange(targetRow.hour);
              e.currentTarget.parentElement?.querySelectorAll('button')[target]?.focus();
            }} />)}
        </div>
      </div>
      <div className="an-time-axis" aria-hidden="true"><span>08:00</span><span>12:00</span><span>16:00</span><span>22:00</span></div>
    </div>
  </figure>;
}

function percentage(value: number, reference: number) {
  if (!reference) return '—';
  const delta = (value / reference - 1) * 100;
  return (delta > 0 ? '+' : '') + delta.toFixed(1) + '%';
}

export function OperatingAnalytics({ scenario, onHourChange }: Props) {
  const [rankBy, setRankBy] = useState<'occupancy' | 'revenueCents'>('occupancy');
  const [showAll, setShowAll] = useState(false);
  const title = useId();
  const { current, daily, series, zones, inventory, checkouts } = scenario;
  const live = isLive(scenario) ? scenario : undefined;
  const statusLabel = live?.status === 'preopen' ? '开店前' : live?.status === 'closed' ? '已闭店' : '营业中';
  const dataTime = live ? minuteTime(live.minuteOfDay) : undefined;
  const detailLabel = live?.status === 'preopen' ? '开店前准备'
    : live?.status === 'closed' ? '最后营业时段 · 21:00–22:00'
    : live ? `时段截至 ${dataTime} · ${live.elapsedMinutes} 分钟` : `所选整点情景 · ${span(scenario.hour)}`;
  const ref = buildOperatingScenario(scenario.day === 'weekday' ? 'weekend' : 'weekday', scenario.hour);
  const scaleSeries = [...series, ...ref.series];
  const checkout = [...checkouts].sort((a, b) => b.waitMin - a.waitMin);
  const stock = [...inventory].sort((a, b) => inventoryRank[a.status] - inventoryRank[b.status] ||
    a.onHand / a.reorderPoint - b.onHand / b.reorderPoint);
  const stockout = stock.filter(row => row.status === 'out');
  const low = stock.filter(row => row.status === 'low');
  const longest = checkout[0], mostQueued = [...checkout].sort((a, b) => b.queueLength - a.queueLength)[0];
  const rank = [...zones].sort((a, b) => b[rankBy] - a[rankBy]);
  const maxZone = Math.max(1, rank[0]?.[rankBy] ?? 0);
  const maxWait = Math.max(1, Math.ceil(longest?.waitMin ?? 0));
  const peak = series.reduce((a, b) => a.entrants >= b.entrants ? a : b, current);
  const metrics = [
    { key: 'revenueCents', label: '销售额', render: (v: number) => amount.format(v / 100) },
    { key: 'entrants', label: '进店', render: (v: number) => `${number.format(v)} 人` },
    { key: 'transactions', label: '成交', render: (v: number) => `${number.format(v)} 单` },
    { key: 'basketCents', label: '客单价', render: (v: number) => amount.format(v / 100) },
  ] as const;
  const mainKpis = live?.cumulative ?? daily;
  const showcaseZones = !live || live.status === 'open';
  const checkoutActive = !live || live.status === 'open';

  return <section className="an-view" aria-labelledby={title}>
    <div className="an-inner">
      <header className="an-header"><div><p className="an-kicker">YH TWINOPS / 经营分析</p>
        <h2 id={title}>门店经营看板</h2>
        <p>分时趋势、分区表现与营运风险</p></div>
        <div className="an-context"><span className="an-badge">合成教学 · 非实时</span>
          <span>{scenario.date} · 北京时间（UTC+8）</span>
          <span>{live ? `跟随时间 · ${dataTime} · ${statusLabel}` : `手动整点情景 · ${span(scenario.hour)}`}</span></div>
      </header>
      <section className="an-brief" aria-label="本时段优先关注">
        <div><p className="an-kicker">值班提示 · {detailLabel}</p>
          <h3>{live?.status === 'preopen' ? '尚未开店，未累计经营数据'
            : live?.status === 'closed' ? '当日模拟营业已结束' : mostQueued && mostQueued.queueLength >= 15 ? '先核查收银拥堵'
            : stockout.length ? '先核查样本商品断货' : low.length ? '关注样本低库存' : '未触发队列或样本库存提示'}</h3></div>
        <p>{live?.status === 'preopen' ? '以下曲线是全日预测，开店后才开始累计经营数据。'
          : live?.status === 'closed' ? '可查看截至闭店的累计，也可点选时间切换到手动整点情景。' : mostQueued && mostQueued.queueLength >= 15
          ? `${short(mostQueued.name)}模拟队列 ${mostQueued.queueLength} 人，达到教学告警阈值（15 人）。建议到点核查等候与开道情况。`
          : stockout.length ? `${stockout.map(row => row.name).join('、')}模拟在手为 0，建议先核实货架与可用库存。`
          : low.length ? `${low.length} 个样本商品库存不高于各自阈值，建议核实补货条件。` : '仅涵盖收银队列与 5 个样本商品，不代表整店运行正常。'}</p>
      </section>

      <section className="an-day" aria-label={live ? '截至当前累计' : '全日情景对照'}>
        <div className="an-section-heading"><div><p className="an-kicker">{live ? `截至 ${dataTime} · 合成累计` : '全日推演 · 08:00–22:00'}</p><h3>经营总览</h3></div>
          <span>{live ? '参照为当日全日推演（08:00–22:00），未用于累计' : `对照：${ref.day === 'weekday' ? '工作日' : '周末'} ${ref.date} · 情景差异，非同比`}</span></div>
        <dl className="an-kpis">{metrics.map(({ key, label, render }) => <div key={key}>
          <dt>{label}</dt><dd>{key === 'basketCents' && !mainKpis.transactions ? '—' : render(mainKpis[key])}</dd>
          {live ? <small>全日推演 {render(live.forecastDaily[key])}</small>
            : <small>{render(ref.daily[key])} 对照 <b>{percentage(mainKpis[key], ref.daily[key])}</b></small>}
        </div>)}</dl>
      </section>

      <div className="an-main-grid">
        <section className="an-panel" aria-label="全日分时趋势">
          <div className="an-section-heading"><div><p className="an-kicker">全日趋势 · 每小时</p><h3>客流与销售走势</h3></div><span>{live ? '全日推演进店峰值' : '进店峰值'} {time(peak.hour)} · {peak.entrants} 人</span></div>
          {live && <div className="an-clock-legend" aria-label="分时趋势图例"><span><i/>已完成模拟</span>
            {live.status === 'open' && <span><i className="an-key-current"/>进行中（截至 {dataTime}）</span>}
            {live.status !== 'closed' && <span><i className="an-key-forecast"/>整点预测（未计入累计）</span>}</div>}
          <p className="an-muted">{live ? '点选时段或使用方向键将切换到手动整点情景。' : '点选图中时段，或用方向键切换。三个图与下方明细同步。'}</p>
          {(['entrants', 'transactions', 'revenueCents'] as const).map(metric => <MetricPlot key={metric} {...{ metric, series, scaleSeries, selected: current, onHourChange, live }}/>)}
        </section>
        <section className="an-panel" aria-label="分区表现">
          <div className="an-section-heading"><div><p className="an-kicker">{detailLabel}</p><h3>分区表现</h3></div></div>
          {showcaseZones ? <>
          <SegmentedControl className="an-tabs" aria-label="分区排名口径" value={rankBy} onValueChange={value => {
            if (value === 'occupancy' || value === 'revenueCents') setRankBy(value);
          }}><SegmentedControlIndicator/><SegmentedControlItem value="occupancy">{live ? '模拟在场' : '平均在场'}</SegmentedControlItem>
            <SegmentedControlItem value="revenueCents">销售额</SegmentedControlItem></SegmentedControl>
          <p className="an-muted">{rankBy === 'occupancy' ? (live ? '最近停留窗口内的模拟在场估算，非传感器观测。' : '时段平均在场估算，非时点观测或实际拥挤率。') : '所选时段线下销售分配，不含线上。'}</p>
          <ol className="an-rank">{(showAll ? rank : rank.slice(0, 8)).map(row => <li key={row.zoneId}>
            <div><span>{short(row.name)}</span><strong>{rankBy === 'occupancy' ? `${row.occupancy} 人` : amount.format(row.revenueCents / 100)}</strong></div>
            <div aria-hidden="true" className="an-track"><span style={{ width: `${row[rankBy] / maxZone * 100}%` }}/></div>
          </li>)}</ol>
          {rank.length > 8 && <button type="button" className="an-more" aria-expanded={showAll} onClick={() => setShowAll(b => !b)}>{showAll ? '仅显示前 8 个' : `显示全部 ${rank.length} 个分区`}</button>}
          </> : <p className="an-muted">非营业时段，不展示分区在场和销售排行。可在图中选择整点情景回看。</p>}
        </section>
      </div>

      <div className="an-operating-grid">
        <section className="an-panel" aria-label="收银等候">
          <div className="an-section-heading"><div><p className="an-kicker">{detailLabel}</p><h3>收银等候</h3></div><span>{checkoutActive ? '按等待时间排序' : '非营业时段'}</span></div>
          {checkoutActive ? <><ul className="an-queue">{checkout.map(row => <li key={row.zoneId}>
            <div><strong>{short(row.name)}</strong><span>{row.queueLength} 人排队 · {row.lanesOpen} 条开放</span><b>{row.waitMin.toFixed(1)} 分</b></div>
            <div className="an-track" aria-hidden="true"><span data-risk={row.queueLength >= 15 ? 'high' : 'normal'} style={{ width: `${row.waitMin / maxWait * 100}%` }}/></div>
          </li>)}</ul>
          <p className="an-muted">点位模拟；人数 ≥ 15 触发教学告警，不代表真实排班。</p></>
            : <p className="an-muted">非营业时段，没有当前收银队列数据。</p>}
        </section>
        <section className="an-panel" aria-label="样本库存风险">
          <div className="an-section-heading"><div><p className="an-kicker">{live?.status === 'closed' ? '闭店库存 · 22:00' : detailLabel}</p><h3>样本库存风险</h3></div><span>{stockout.length} 缺货 · {low.length} 低库存</span></div>
          <table className="an-stock"><thead><tr><th scope="col">5 个样本 SKU</th><th scope="col">在手 / 阈值</th><th scope="col">状态</th></tr></thead>
            <tbody>{stock.map(row => <tr key={row.sku}><th scope="row">{row.name}</th>
              <td>{row.onHand} / {row.reorderPoint} {row.unit}</td>
              <td><span data-status={row.status}>{row.status === 'out' ? '缺货' : row.status === 'low' ? '低库存' : '正常'}</span></td>
            </tr>)}</tbody></table>
          <p className="an-muted">排序先缺货、再低库存；在手量线性模拟，未模拟后仓或日内补货。</p>
        </section>
      </div>
      <p className="an-source">数据口径：{scenario.provenance}。{live ? '累计仅含已模拟经过的分钟；整点预测不代表已发生。' : '手动情景展示完整时段与全日推演，不是已发生累计。'} 分区、收银与库存各按上方标注口径。</p>
    </div>
  </section>;
}
