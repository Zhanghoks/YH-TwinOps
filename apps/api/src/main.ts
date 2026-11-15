/**
 * YH-TwinOps 审批沙盒 API（教学模拟后端）。
 * 只做三件事：审批记录的存取、店长决策、回滚。无 LLM、无真实系统写路径。
 */
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { join } from 'node:path';
import { createApprovalStore, type ApprovalRecord } from './approvals';

const DEFAULT_PORT = 8077;

export interface ApiOptions {
  dataDir?: string;
  port?: number;
}

export async function buildApp(options: ApiOptions = {}): Promise<{ app: FastifyInstance; close: () => Promise<void> }> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  const store = createApprovalStore(options.dataDir ?? join(process.cwd(), 'data'));

  app.get('/api/health', async () => ({ ok: true, service: 'yh-approval-sandbox', note: '教学模拟后端：审批记录存本地文件，不触碰真实业务' }));

  app.get('/api/approvals', async (): Promise<{ approvals: ApprovalRecord[] }> => ({ approvals: store.list() }));

  app.post<{ Body: unknown }>('/api/approvals', async (request, reply) => {
    const body = request.body as Partial<import('./approvals').ApprovalInput> | undefined;
    if (
      body === undefined ||
      typeof body.planId !== 'string' ||
      typeof body.scenarioId !== 'string' ||
      typeof body.scenarioName !== 'string' ||
      typeof body.snapshotId !== 'string' ||
      typeof body.seed !== 'number' ||
      body.summary === undefined ||
      typeof body.summary !== 'object'
    ) {
      return reply.status(400).send({ error: '缺少必要字段：planId/scenarioId/scenarioName/snapshotId/seed/summary' });
    }
    const record = store.propose({
      planId: body.planId,
      scenarioId: body.scenarioId,
      scenarioName: body.scenarioName,
      snapshotId: body.snapshotId,
      seed: body.seed,
      summary: body.summary as Record<string, unknown>,
    });
    return reply.status(201).send(record);
  });

  app.post<{ Params: { planId: string }; Body: { decision?: string; decidedBy?: string } }>('/api/approvals/:planId/decision', async (request, reply) => {
    const { decision, decidedBy } = request.body ?? {};
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return reply.status(400).send({ error: "decision 必须是 'APPROVED' 或 'REJECTED'" });
    }
    const record = store.decide(request.params.planId, decision, typeof decidedBy === 'string' && decidedBy.length > 0 ? decidedBy : 'store-manager');
    if (record === null) return reply.status(409).send({ error: '记录不存在或已决策（审批必须由店长亲自触发一次）' });
    return record;
  });

  app.post<{ Params: { planId: string } }>('/api/approvals/:planId/rollback', async (request, reply) => {
    const record = store.rollback(request.params.planId);
    if (record === null) return reply.status(409).send({ error: '记录不存在或未批准（只有已批准的记录可回滚）' });
    return record;
  });

  const port = options.port ?? DEFAULT_PORT;
  await app.listen({ port, host: '127.0.0.1' });
  return { app, close: () => app.close() };
}

// 直接运行（npm run dev / start）时启动；被测试导入时不启动。
if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1] ?? ''}`) {
  await buildApp();
  console.log(`审批沙盒 API 已启动：http://127.0.0.1:${DEFAULT_PORT}（教学模拟，无真实系统写路径）`);
}
