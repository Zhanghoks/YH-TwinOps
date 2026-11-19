import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgent } from '@ui-sdk/react/agent';
import { describe, expect, it } from 'vitest';
import { buildOperatingScenario, type OperatingDay } from '../operatingModel';
import { OperationsDashboard } from './OperationsDashboard';

function Fixture() {
  const [day, setDay] = useState<OperatingDay>('weekday');
  const [hour, setHour] = useState(18);
  const [incidentMode, setIncidentMode] = useState(false);
  return <OperationsDashboard
    scenario={buildOperatingScenario(day, hour)}
    onDayChange={setDay}
    onHourChange={setHour}
    incidentMode={incidentMode}
    onIncidentModeChange={setIncidentMode}
  />;
}

describe('operations dashboard', () => {
  it('keeps the date and the selected hour attached to the same source', async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    expect(screen.getByText(/2026-11-13.*北京时间/)).toBeTruthy();
    const datePicker = createAgent().snapshot().find(entry => entry.label === '模拟日期类型');
    expect(datePicker).toBeDefined();
    await user.click(screen.getByRole('radio', { name: '周末' }));
    expect(screen.getByText(/2026-11-15.*北京时间/)).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: '经营模拟时段' }), '9');
    expect(screen.getByRole<HTMLOptionElement>('option', { name: '09:00–10:00' }).selected).toBe(true);
    expect(screen.getByText('时段进店').nextElementSibling?.textContent).toBe(`${buildOperatingScenario('weekend', 9).current.entrants}人`);
  });

  it('exposes details, and removes operating figures while in the incident exercise', async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole('button', { name: '展开经营明细' }));
    expect(screen.getByRole('table', { name: '分区经营数据' })).toBeTruthy();
    expect(screen.getByRole('table', { name: '收银数据' })).toBeTruthy();
    expect(screen.getByRole('table', { name: '库存预警数据' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '收起经营明细' }));
    expect(screen.queryByRole('table')).toBeNull();
    await user.click(screen.getByRole('button', { name: '进入异常教学情景' }));
    expect(screen.getByText(/经营模拟数据未应用/)).toBeTruthy();
    expect(screen.queryByText('时段销售额')).toBeNull();
    await user.click(screen.getByRole('button', { name: '返回经营模拟' }));
    expect(screen.getByText('时段销售额')).toBeTruthy();
  });
});
