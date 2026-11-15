/**
 * 审批沙盒（教学模拟，PRD §9 / US-41/42）：
 * Agent 建议只能进沙盒；批准/驳回必须由店长亲自触发；记录持久化到本地 JSON 文件，刷新不丢、可回滚。
 * 这是模拟任务单，不触碰任何真实业务系统。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type ApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

/** 一条审批记录：从 Agent 草案到店长决策再到（可选）回滚的完整留痕。 */
export interface ApprovalRecord {
  planId: string;
  scenarioId: string;
  scenarioName: string;
  snapshotId: string;
  seed: number;
  /** 方案摘要（排队/积压/工时/成本），由前端从仿真结果抽取，仅作展示。 */
  summary: Record<string, unknown>;
  status: ApprovalDecision;
  proposedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  rolledBackAt: string | null;
  /** 批准后生成的模拟任务单（人审通过才有）。 */
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

export interface ApprovalStore {
  list(): ApprovalRecord[];
  propose(input: ApprovalInput): ApprovalRecord;
  decide(planId: string, decision: 'APPROVED' | 'REJECTED', decidedBy: string): ApprovalRecord | null;
  rollback(planId: string): ApprovalRecord | null;
}

function taskSheetFor(record: ApprovalRecord): Record<string, unknown> {
  return {
    sheetId: `task-${record.planId}`,
    kind: '模拟任务单（教学沙盒，不派发真实执行）',
    scenarioName: record.scenarioName,
    snapshotId: record.snapshotId,
    seed: record.seed,
    steps: [
      `按方案「${record.scenarioName}」调整收银通道/人员安排（模拟执行说明）`,
      '高峰时段结束后对比实际排队与模拟区间（模拟复盘说明）',
    ],
    note: '此任务单为课程演示用的模拟文书，不代表真实门店执行指令',
  };
}

export function createApprovalStore(dataDir: string): ApprovalStore {
  const file = join(dataDir, 'approvals.json');
  mkdirSync(dirname(file), { recursive: true });

  const load = (): ApprovalRecord[] => {
    if (!existsSync(file)) return [];
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
      return Array.isArray(raw) ? (raw as ApprovalRecord[]) : [];
    } catch {
      // 损坏的本地数据如实视为空并等待覆写（教学沙盒，不做静默恢复）。
      return [];
    }
  };

  const save = (records: ApprovalRecord[]): void => {
    writeFileSync(file, `${JSON.stringify(records, null, 2)}\n`);
  };

  return {
    list: () => load(),
    propose: (input) => {
      const records = load();
      const existing = records.find((r) => r.planId === input.planId);
      if (existing !== undefined) return existing; // 幂等：同一草案重复提交不产生重复记录
      const record: ApprovalRecord = {
        ...input,
        status: 'PENDING',
        proposedAt: new Date().toISOString(),
        decidedAt: null,
        decidedBy: null,
        rolledBackAt: null,
        taskSheet: null,
      };
      records.push(record);
      save(records);
      return record;
    },
    decide: (planId, decision, decidedBy) => {
      const records = load();
      const record = records.find((r) => r.planId === planId);
      if (record === undefined || record.status !== 'PENDING') return null;
      record.status = decision;
      record.decidedAt = new Date().toISOString();
      record.decidedBy = decidedBy;
      record.taskSheet = decision === 'APPROVED' ? taskSheetFor(record) : null;
      save(records);
      return record;
    },
    rollback: (planId) => {
      const records = load();
      const record = records.find((r) => r.planId === planId);
      if (record === undefined || record.status !== 'APPROVED') return null;
      record.rolledBackAt = new Date().toISOString();
      save(records);
      return record;
    },
  };
}
