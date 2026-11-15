import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type ApiOptions } from './main';
import { createApprovalStore } from './approvals';

describe('审批沙盒（US-41/42：人审留痕、刷新不丢、可回滚）', () => {
  let dataDir: string;
  let close: (() => Promise<void>) | null = null;
  let base = '';

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'yh-approvals-'));
  });

  afterEach(async () => {
    if (close !== null) {
      await close();
      close = null;
    }
  });

  async function start(): Promise<void> {
    const options: ApiOptions = { dataDir, port: 0 };
    const built = await buildApp(options);
    close = built.close;
    const addr = built.app.server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr !== null ? addr.port : 0}`;
  }

  const proposal = {
    planId: 'plan-sc-1-snap-1',
    scenarioId: 'sc-1',
    scenarioName: 'C 调 1 人支援收银',
    snapshotId: 'snap-1',
    seed: 42,
    summary: { extraStaffHours: 0.5, extraCostCny: 12.5 },
  };

  async function post(path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      // 无 body 时不带 content-type：避免 Fastify 把空请求体当非法 JSON 解析（400）。
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  it('草案入库为 PENDING；重复提交幂等', async () => {
    await start();
    const first = await post('/api/approvals', proposal);
    expect(first.status).toBe(201);
    expect(first.body['status']).toBe('PENDING');
    const again = await post('/api/approvals', proposal);
    expect(again.status).toBe(201);
    expect(again.body['proposedAt']).toBe(first.body['proposedAt']);
  });

  it('批准生成模拟任务单；回滚留痕；未批准不可回滚', async () => {
    await start();
    await post('/api/approvals', proposal);
    const ok = await post(`/api/approvals/${proposal.planId}/decision`, { decision: 'APPROVED', decidedBy: '店长' });
    expect(ok.status).toBe(200);
    expect(ok.body['status']).toBe('APPROVED');
    expect(ok.body['decidedBy']).toBe('店长');
    const sheet = ok.body['taskSheet'] as Record<string, unknown>;
    expect(String(sheet['kind'])).toMatch(/模拟任务单/);

    const rolled = await post(`/api/approvals/${proposal.planId}/rollback`);
    expect(rolled.status).toBe(200);
    expect(rolled.body['rolledBackAt']).not.toBeNull();

    await post('/api/approvals', { ...proposal, planId: 'plan-sc-2-snap-1' });
    const bad = await post('/api/approvals/plan-sc-2-snap-1/rollback');
    expect(bad.status).toBe(409);
  });

  it('记录持久化到文件：重建 store 后仍在（刷新不丢）', async () => {
    const storeA = createApprovalStore(dataDir);
    storeA.propose(proposal);
    storeA.decide(proposal.planId, 'REJECTED', '店长');
    const storeB = createApprovalStore(dataDir); // 模拟服务重启 / 页面刷新后再查
    const list = storeB.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.status).toBe('REJECTED');
    expect(list[0]?.decidedAt).not.toBeNull();
    expect(existsSync(join(dataDir, 'approvals.json'))).toBe(true);
    expect(readFileSync(join(dataDir, 'approvals.json'), 'utf8')).toContain('plan-sc-1-snap-1');
  });

  it('非法决策与重复决策被拒绝（审批必须由店长触发且只触发一次）', async () => {
    await start();
    await post('/api/approvals', proposal);
    const invalid = await post(`/api/approvals/${proposal.planId}/decision`, { decision: 'MAYBE' });
    expect(invalid.status).toBe(400);
    await post(`/api/approvals/${proposal.planId}/decision`, { decision: 'APPROVED' });
    const twice = await post(`/api/approvals/${proposal.planId}/decision`, { decision: 'REJECTED' });
    expect(twice.status).toBe(409);
  });
});
