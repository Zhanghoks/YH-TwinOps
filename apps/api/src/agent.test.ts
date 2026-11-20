import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { METRICS } from '@yh/contracts';
import { makeSignal, makeTestLayout } from '@yh/contracts/testing';
import { buildApp } from './main';
import { getAgentStatus, parseAskBody } from './agent';

describe('门店助手 API（pi 接入缝：默认本地规则）', () => {
  let dataDir: string;
  let close: (() => Promise<void>) | null = null;
  let base = '';

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'yh-agent-api-'));
  });

  afterEach(async () => {
    if (close !== null) {
      await close();
      close = null;
    }
  });

  async function start(env: NodeJS.ProcessEnv = {}): Promise<void> {
    const built = await buildApp({
      dataDir,
      port: 0,
      env: { ...process.env, YH_AGENT_PROVIDER: '', YH_AGENT_MODEL: '', YH_AGENT_API_KEY: '', ...env },
    });
    close = built.close;
    const addr = built.app.server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr !== null ? addr.port : 0}`;
  }

  it('未配置 YH_AGENT_* 时 status 为 rules-local', () => {
    const status = getAgentStatus({
      YH_AGENT_PROVIDER: undefined,
      YH_AGENT_MODEL: undefined,
    });
    expect(status.engine).toBe('rules-local');
    expect(status.model).toBe('yh-rules-local-0.1');
  });

  it('配置了 provider/model 时 status 标明 pi-llm（凭证不回传）', () => {
    const status = getAgentStatus({
      YH_AGENT_PROVIDER: 'openai',
      YH_AGENT_MODEL: 'gpt-4.1-mini',
      YH_AGENT_API_KEY: 'secret-should-not-leak',
    });
    expect(status.engine).toBe('pi-llm');
    expect(status.model).toBe('openai/gpt-4.1-mini');
    expect(JSON.stringify(status)).not.toContain('secret-should-not-leak');
  });

  it('parseAskBody 拒绝空问题与坏信号', () => {
    expect(parseAskBody({ question: '  ', at: '2026-11-15T18:00:00Z', layout: makeTestLayout(), signals: [] }).ok).toBe(false);
    expect(parseAskBody({ question: '概况', at: '2026-11-15T18:00:00Z', layout: makeTestLayout(), signals: [{ bad: true }] }).ok).toBe(false);
  });

  it('POST /api/agent/ask 无凭证时走本地规则并返回证据', async () => {
    await start({ YH_AGENT_PROVIDER: '', YH_AGENT_MODEL: '' });
    const layout = makeTestLayout();
    const signals = [
      makeSignal({ id: 'q1', zoneId: 'zone-checkout', metric: METRICS.queueLength, unit: '人', value: 16, observedAt: '2026-11-15T17:59:00Z' }),
      makeSignal({ id: 'lanes1', zoneId: 'zone-checkout', metric: METRICS.checkoutLanesOpen, unit: '条', value: 4, observedAt: '2026-11-15T17:59:00Z' }),
      makeSignal({ id: 'staff1', zoneId: 'zone-checkout', metric: METRICS.staffCount, unit: '人', value: 2, observedAt: '2026-11-15T17:59:00Z' }),
      makeSignal({ id: 'qual1', zoneId: 'zone-checkout', metric: METRICS.checkoutQualifiedStaff, unit: '人', value: 1, observedAt: '2026-11-15T17:59:00Z' }),
      makeSignal({ id: 'arr1', zoneId: 'zone-checkout', metric: 'checkout_arrivals_per_min', unit: '人/分钟', value: 6, observedAt: '2026-11-15T17:59:00Z' }),
      makeSignal({ id: 'svc1', zoneId: 'zone-checkout', metric: METRICS.checkoutServiceRate, unit: '人/分钟/通道', value: 2.5, observedAt: '2026-11-15T17:59:00Z' }),
    ];
    const res = await fetch(`${base}/api/agent/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: '调 3 人支援收银行不行？',
        at: '2026-11-15T18:00:00Z',
        layout,
        signals,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string; answer: string; evidence: unknown[] };
    expect(body.mode).toBe('rules-local');
    expect(body.answer).toMatch(/无法执行|岗位资格/);
    expect(body.evidence.length).toBeGreaterThan(0);

    const statusRes = await fetch(`${base}/api/agent/status`);
    expect(statusRes.status).toBe(200);
    const status = (await statusRes.json()) as { engine: string };
    expect(status.engine).toBe('rules-local');
  });

  it('POST /api/agent/ask 非法上下文明确 400，不进入模型', async()=>{
    await start();
    for(const patch of [{merchandising:{products:{},placements:[]}},{at:'not-a-date'},{signals:{}},{question:'x'.repeat(4001)},{merchandising:{products:[],placements:[],validSlotIdsByFixture:{F077:['forged']}}}]) {
      const response=await fetch(`${base}/api/agent/ask`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'F077 上有什么？',at:'2026-11-15T18:00:00Z',layout:makeTestLayout(),signals:[],...patch})});
      expect(response.status).toBe(400);
      expect(await response.json()).toHaveProperty('error');
    }
  });

  it('pi 失败时 502 不回传凭证或上游错误原文', async () => {
    await start({
      YH_AGENT_PROVIDER: 'no-such-provider',
      YH_AGENT_MODEL: 'no-such-model',
      YH_AGENT_API_KEY: 'secret-should-not-leak',
    });
    const res = await fetch(`${base}/api/agent/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: '概况',
        at: '2026-11-15T18:00:00Z',
        layout: makeTestLayout(),
        signals: [],
      }),
    });
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain('门店助手后端失败');
    expect(text).not.toContain('secret-should-not-leak');
    expect(text).not.toContain('未收录模型');
  });
});
