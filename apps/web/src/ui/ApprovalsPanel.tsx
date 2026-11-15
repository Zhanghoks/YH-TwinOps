/** 审批面板（US-41/42）：店长亲自批准/驳回，记录留痕、刷新不丢、可回滚。 */
import { useCallback, useEffect, useState } from 'react';
import type { ApprovalRecord, ApprovalsClient } from '../api';

function fmtTime(iso: string | null): string {
  return iso === null ? '—' : iso.replace('T', ' ').replace('Z', ' UTC');
}

function StatusChip({ status }: { status: ApprovalRecord['status'] }): React.JSX.Element {
  return <span className={`chip chip-${status.toLowerCase()}`}>{status === 'PENDING' ? '待店长决策' : status === 'APPROVED' ? '已批准' : '已驳回'}</span>;
}

export function ApprovalsPanel({
  client,
  refreshKey,
  onRecordsChanged,
}: {
  client: ApprovalsClient | null;
  refreshKey: number;
  onRecordsChanged: () => void;
}) {
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (client === null) return;
    client
      .list()
      .then(setRecords)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [client]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const act = (fn: () => Promise<unknown>): void => {
    setError(null);
    fn()
      .then(() => {
        refresh();
        onRecordsChanged();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  if (client === null) {
    return (
      <div className="panel">
        <div className="panel-note">审批沙盒连接中……</div>
      </div>
    );
  }

  return (
    <div className="panel">
      {client.mode === 'local' && (
        <div className="warn-box">审批沙盒 API 未连接：记录暂存浏览器本地（localStorage）——教学简化，关闭浏览器前请自行导出。</div>
      )}
      {client.mode === 'api' && <div className="panel-note">已连接审批沙盒 API（服务端文件持久化，刷新不丢）。批准/驳回必须由店长亲自触发。</div>}
      {records.length === 0 && <div className="muted">暂无审批记录——到「方案对比」页把方案 C 送店长审批。</div>}
      {records.map((r) => (
        <div key={r.planId} className={`approval-card status-${r.status.toLowerCase()}`}>
          <div className="approval-head">
            <code>{r.planId}</code>
            <StatusChip status={r.status} />
          </div>
          <div>{r.scenarioName}</div>
          <div className="muted">
            快照 {r.snapshotId} · seed {r.seed} · 送审 {fmtTime(r.proposedAt)} · 决策 {fmtTime(r.decidedAt)}（{r.decidedBy ?? '—'}）
            {r.rolledBackAt !== null ? ` · 已回滚 ${fmtTime(r.rolledBackAt)}` : ''}
          </div>
          <div className="muted">
            摘要：平均排队 {String(r.summary['avgWaitMean'] ?? '—')} 分钟｜积压 {String(r.summary['maxBacklogMean'] ?? '—')} 人｜工时{' '}
            {String(r.summary['extraStaffHours'] ?? '—')} 小时｜成本 {String(r.summary['extraCostCny'] ?? '未核算')} 元
          </div>
          {r.taskSheet !== null && (
            <div className="task-sheet">
              <strong>{String(r.taskSheet['sheetId'])}</strong>（{String(r.taskSheet['kind'])}）
              <ul>
                {(r.taskSheet['steps'] as string[] | undefined)?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="approval-actions">
            {r.status === 'PENDING' && (
              <>
                <button className="primary" onClick={() => act(() => client.decide(r.planId, 'APPROVED'))}>
                  批准（店长）
                </button>
                <button className="danger" onClick={() => act(() => client.decide(r.planId, 'REJECTED'))}>
                  驳回（店长）
                </button>
              </>
            )}
            {r.status === 'APPROVED' && r.rolledBackAt === null && (
              <button className="danger" onClick={() => act(() => client.rollback(r.planId))}>
                回滚本次批准
              </button>
            )}
          </div>
        </div>
      ))}
      {error !== null && <div className="alert-box">{error}</div>}
    </div>
  );
}
