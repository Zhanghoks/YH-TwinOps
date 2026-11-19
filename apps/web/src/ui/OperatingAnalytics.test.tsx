import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { buildOperatingScenario } from '../operatingModel';
import { buildLiveOperatingScenario } from '../operatingClock';
import { OperatingAnalytics } from './OperatingAnalytics';

afterEach(cleanup);
const evening = buildOperatingScenario('weekend', 18);

test('synchronizes the charts and detail scope through keyboard and point clicks', () => {
  function Fixture() {
    const [hour, setHour] = useState(18);
    return <OperatingAnalytics scenario={buildOperatingScenario('weekend', hour)} onHourChange={setHour} />;
  }
  render(<Fixture />);
  const chart = (name: string) => within(screen.getByRole('group', { name }));
  const charts = [chart('进店图表时段'), chart('成交图表时段'), chart('销售额图表时段')] as const;
  expect(charts[0].getByRole('button', { pressed: true }).getAttribute('aria-label')).toContain('579 人');
  const active = charts[0].getByRole('button', { pressed: true });
  active.focus();
  fireEvent.keyDown(active, { key: 'ArrowLeft' });
  charts.forEach(chart => expect(chart.getByRole('button', { pressed: true }).getAttribute('aria-label')).toMatch(/^17:00–18:00/u));
  expect(document.activeElement).toBe(charts[0].getByRole('button', { pressed: true }));
  expect(screen.getByLabelText('本时段优先关注').textContent).toContain('17:00–18:00');
  fireEvent.click(charts[2].getByRole('button', { name: /^10:00/u }));
  charts.forEach(chart => expect(chart.getByRole('button', { pressed: true }).getAttribute('aria-label')).toMatch(/^10:00–11:00/u));
});

test('switches zone ranking units, expands to all zones, and sorts inventory by risk', () => {
  render(<OperatingAnalytics scenario={evening} onHourChange={() => {}} />);
  const zone = within(screen.getByLabelText('分区表现'));
  expect(zone.getByRole('radio', { name: '平均在场' })).toBeTruthy();
  expect(zone.getAllByRole('listitem')).toHaveLength(8);
  expect(zone.getAllByRole('listitem')[0]?.textContent).toContain('55 人');
  fireEvent.click(zone.getByRole('radio', { name: '销售额' }));
  expect(zone.getAllByRole('listitem')[0]?.textContent).toContain('6,597.85');
  fireEvent.click(zone.getByRole('button', { name: /显示全部/u }));
  expect(zone.getAllByRole('listitem')).toHaveLength(evening.zones.length);
  const stocks = within(screen.getByLabelText('样本库存风险')).getAllByRole('row').slice(1);
  expect(stocks).toHaveLength(5);
  expect(stocks.map(row => within(row).getAllByRole('cell')[1]?.textContent)).toEqual(['缺货', '缺货', '低库存', '低库存', '正常']);
  expect(screen.getByLabelText('本时段优先关注').textContent).toContain('先核查收银拥堵');
  expect(screen.getByLabelText('全日情景对照').textContent).toContain('情景差异，非同比');
});

test('labels live cumulative separately from forecast, with accessible past/partial/future data', () => {
  const live = buildLiveOperatingScenario(new Date('2026-11-15T10:24:00Z'));
  const selected: number[] = [];
  render(<OperatingAnalytics scenario={live} onHourChange={hour => selected.push(hour)} />);
  expect(screen.getByRole('radio', { name: '模拟在场' })).toBeTruthy();
  expect(screen.getByText('最近停留窗口内的模拟在场估算，非传感器观测。')).toBeTruthy();
  const totals = within(screen.getByLabelText('截至当前累计'));
  expect(totals.getAllByRole('definition')[1]?.textContent).toBe(`${live.cumulative.entrants.toLocaleString('zh-CN')} 人`);
  expect(totals.getByText('全日推演 4,976 人')).toBeTruthy();
  const charts = within(screen.getByRole('group', { name: '进店图表时段' }));
  expect(charts.getByRole('button', { name: /^17:00.*已完成模拟/u })).toBeTruthy();
  expect(charts.getByRole('button', { name: /^18:00.*进行中模拟进店 \d+ 人；整点预测 579 人/u })).toBeTruthy();
  const forecast = charts.getByRole('button', { name: /^19:00.*未开始.*预测/u });
  fireEvent.click(forecast);
  expect(selected).toEqual([19]);
});

test('pre-open has zero cumulative and forecast-only future, while closed hides active queue', () => {
  const preopen = buildLiveOperatingScenario(new Date('2026-11-14T23:10:00Z'));
  const { rerender } = render(<OperatingAnalytics scenario={preopen} onHourChange={() => {}} />);
  const totals = within(screen.getByLabelText('截至当前累计'));
  expect(totals.getAllByRole('definition')[1]?.textContent).toBe('0 人');
  expect(totals.getAllByRole('definition')[3]?.textContent).toBe('—');
  expect(screen.getByRole('button', { name: /^08:00.*未开始，进店预测/u })).toBeTruthy();
  const closed = buildLiveOperatingScenario(new Date('2026-11-15T14:20:00Z'));
  rerender(<OperatingAnalytics scenario={closed} onHourChange={() => {}} />);
  expect(screen.getByText('当日模拟营业已结束')).toBeTruthy();
  expect(screen.queryByText('整点预测（未计入累计）')).toBeNull();
  expect(screen.getByText('非营业时段，没有当前收银队列数据。')).toBeTruthy();
});
