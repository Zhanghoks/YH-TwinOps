/**
 * 审批沙盒客户端：优先走 apps/api（服务端文件持久化）；API 不可达时降级为
 * 浏览器 localStorage 沙盒并如实标注（教学简化，刷新仍不丢）。
 */

export interface ApprovalRecord {
  planId: string;
  scenarioId: string;
  scenarioName: string;
  snapshotId: string;
  seed: number;
  summary: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  proposedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  rolledBackAt: string | null;
  taskSheet: Record<string, unknown> | null;
}

export interface ApprovalInput {
  planId: string;
  scenarioId: string;
  scenarioName: string;
  snapshotId: string;
  seed: number;
  summary: Record<string, unknown>;
}

const LS_KEY = 'yh-approval-sandbox-local';

function localList(): ApprovalRecord[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as ApprovalRecord[];
  } catch {
    return [];
  }
}

function localSave(records: ApprovalRecord[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(records));
}

export interface ApprovalsClient {
  mode: 'api' | 'local';
  list(): Promise<ApprovalRecord[]>;
  propose(input: ApprovalInput): Promise<ApprovalRecord>;
  decide(planId: string, decision: 'APPROVED' | 'REJECTED'): Promise<ApprovalRecord>;
  rollback(planId: string): Promise<ApprovalRecord>;
}

function localClient(): ApprovalsClient {
  return {
    mode: 'local',
    list: async () => localList(),
    propose: async (input) => {
      const records = localList();
      const existing = records.find((r) => r.planId === input.planId);
      if (existing !== undefined) return existing;
      const record: ApprovalRecord = { ...input, status: 'PENDING', proposedAt: new Date().toISOString(), decidedAt: null, decidedBy: null, rolledBackAt: null, taskSheet: null };
      records.push(record);
      localSave(records);
      return record;
    },
    decide: async (planId, decision) => {
      const records = localList();
      const record = records.find((r) => r.planId === planId && r.status === 'PENDING');
      if (record === undefined) throw new Error('记录不存在或已决策');
      record.status = decision;
      record.decidedAt = new Date().toISOString();
      record.decidedBy = '店长（本地沙盒）';
      record.taskSheet =
        decision === 'APPROVED'
          ? { sheetId: `task-${planId}`, kind: '模拟任务单（本地教学沙盒）', steps: ['按方案调整收银通道/人员（模拟）', '高峰后对比实际与模拟区间（模拟）'] }
          : null;
      localSave(records);
      return record;
    },
    rollback: async (planId) => {
      const records = localList();
      const record = records.find((r) => r.planId === planId && r.status === 'APPROVED');
      if (record === undefined) throw new Error('记录不存在或未批准');
      record.rolledBackAt = new Date().toISOString();
      localSave(records);
      return record;
    },
  };
}

/** 探测 API：/api/health 可达 → 服务端沙盒；否则本地沙盒。 */
export async function createApprovalsClient(): Promise<ApprovalsClient> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const health = (await res.json()) as { service?: string };
      if (health.service === 'yh-approval-sandbox') return apiClient();
    }
  } catch {
    // API 未启动 —— 降级本地沙盒（UI 会如实标注）。
  }
  return localClient();
}

function apiClient(): ApprovalsClient {
  const call = async <T>(path: string, body?: unknown, method?: 'GET' | 'POST'): Promise<T> => {
    const res = await fetch(path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`审批沙盒 API ${res.status}：${text}`);
    }
    return (await res.json()) as T;
  };
  return {
    mode: 'api',
    list: () => call<{ approvals: ApprovalRecord[] }>('/api/approvals').then((r) => r.approvals),
    propose: (input) => call<ApprovalRecord>('/api/approvals', input),
    decide: (planId, decision) => call<ApprovalRecord>(`/api/approvals/${planId}/decision`, { decision, decidedBy: '店长' }),
    rollback: (planId) => call<ApprovalRecord>(`/api/approvals/${planId}/rollback`, undefined, 'POST'),
  };
}
