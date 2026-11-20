import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeTestLayout, TEST_AT } from '@yh/contracts/testing';
import { projectTwinState } from '@yh/twin-state';
import type { ApprovalRecord, ApprovalsClient } from '../api';
import { AlertsPanel } from './AlertsPanel';
import { ApprovalsPanel } from './ApprovalsPanel';

describe('教学告警与人工审批', () => {
  it('为空时仍能辨识告警中心，不产生虚构告警', () => {
    const snapshot = projectTwinState([], makeTestLayout(), TEST_AT);
    render(<AlertsPanel snapshot={snapshot} />);
    expect(screen.getByRole('heading', { name: '告警中心' })).toBeTruthy();
    expect(screen.getByText('当前无告警（规则阈值内）。')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('保留本地降级提示与人工批准，再由人单独发起回滚', async () => {
    let record: ApprovalRecord = {
      planId: 'plan-C', scenarioId: 'sc-C', scenarioName: '方案 C', status: 'PENDING', snapshotId: 'snapshot-demo',
      seed: 14, proposedAt: TEST_AT, decidedAt: null, decidedBy: null, rolledBackAt: null, taskSheet: null,
      summary: { avgWaitMean: 0, extraCostCny: 0 },
    };
    const decide = vi.fn(async (_planId: string, decision: 'APPROVED' | 'REJECTED') => {
      record = { ...record, status: decision, decidedAt: TEST_AT, decidedBy: 'manager' };
      return record;
    });
    const rollback = vi.fn(async (_planId: string) => {
      record = { ...record, rolledBackAt: TEST_AT };
      return record;
    });
    const client: ApprovalsClient = {
      mode: 'local',
      list: async () => [record],
      propose: async () => record,
      decide,
      rollback,
    };
    render(<ApprovalsPanel client={client} refreshKey={0} onRecordsChanged={() => {}} />);
    expect(screen.getByText(/记录暂存浏览器本地/)).toBeTruthy();
    expect(await screen.findByText('待店长决策')).toBeTruthy();
    expect(screen.getByText('0 分钟')).toBeTruthy();
    expect(decide).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '批准（店长）' }));
    expect(decide.mock.calls).toEqual([['plan-C', 'APPROVED']]);
    expect(await screen.findByText('已批准')).toBeTruthy();
    expect(rollback).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '回滚本次批准' }));
    expect(rollback.mock.calls).toEqual([['plan-C']]);
    expect(await screen.findByText('已回滚')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '回滚本次批准' })).toBeNull();
  });
});
