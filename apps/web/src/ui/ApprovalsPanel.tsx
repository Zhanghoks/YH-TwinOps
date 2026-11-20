/** 审批面板（US-41/42）：店长亲自批准/驳回，记录留痕、刷新不丢、可回滚。 */
import { useCallback, useEffect, useState } from 'react';
import type { ApprovalRecord, ApprovalsClient } from '../api';
import { BeautifulButton } from './beautiful/Button';
import { ReviewHeading, ReviewNotice } from './ReviewTabs';

function fmtTime(iso: string | null): string {
  return iso === null ? '—' : iso.replace('T', ' ').replace('Z', ' UTC');
}

function StatusChip({ status }: { status: ApprovalRecord['status'] }): React.JSX.Element {
  return <span className="yh-review-tag" data-tone={status.toLowerCase()}>{status === 'PENDING' ? '待店长决策' : status === 'APPROVED' ? '已批准' : '已驳回'}</span>;
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
      <section className="yh-review" aria-label="审批沙盒">
        <ReviewHeading icon="approvals" title="审批沙盒" description="由店长决定 · 所有操作留痕" />
        <ReviewNotice>审批沙盒连接中……</ReviewNotice>
      </section>
    );
  }

  return (
    <section className="yh-review" aria-label="审批沙盒">
      <ReviewHeading icon="approvals" title="审批沙盒" description="由店长决定 · 所有操作留痕" detail={`${records.length} 条`} />
      {client.mode === 'local' && (
        <ReviewNotice tone="warning">审批沙盒 API 未连接：记录暂存浏览器本地（localStorage）——教学简化，关闭浏览器前请自行导出。</ReviewNotice>
      )}
      {client.mode === 'api' && <ReviewNotice>已连接审批沙盒 API（服务端文件持久化，刷新不丢）。批准/驳回必须由店长亲自触发。</ReviewNotice>}
      {records.length === 0 && <ReviewNotice>暂无审批记录。到「方案对比」页把方案 C 送店长审批。</ReviewNotice>}
      {records.map((r) => (
        <article key={r.planId} className="yh-review-card">
          <div className="yh-review-card-body">
            <div className="yh-review-card-title">
              <h4>{r.scenarioName}</h4>
              {r.rolledBackAt === null ? <StatusChip status={r.status} /> : <span className="yh-review-tag">已回滚</span>}
            </div>
            <div className="yh-review-refs"><code>{r.planId}</code></div>
            <dl className="yh-review-kv">
              <dt>快照 / 种子</dt><dd>{r.snapshotId} / {r.seed}</dd>
              <dt>送审</dt><dd>{fmtTime(r.proposedAt)}</dd>
              <dt>决策</dt><dd>{fmtTime(r.decidedAt)}（{r.decidedBy ?? '—'}）{r.rolledBackAt !== null && ' · 曾批准'}</dd>
              {r.rolledBackAt !== null && <><dt>回滚</dt><dd>{fmtTime(r.rolledBackAt)}</dd></>}
              <dt>平均排队</dt><dd>{String(r.summary['avgWaitMean'] ?? '—')} 分钟</dd>
              <dt>积压人数</dt><dd>{String(r.summary['maxBacklogMean'] ?? '—')} 人</dd>
              <dt>工时 / 成本</dt><dd>{String(r.summary['extraStaffHours'] ?? '—')} 小时 / {r.summary['extraCostCny'] == null ? '未核算' : `${String(r.summary['extraCostCny'])} 元`}</dd>
            </dl>
            {r.taskSheet !== null && (
              <div className="yh-review-task-sheet">
                <strong>{String(r.taskSheet['sheetId'])}</strong>（{String(r.taskSheet['kind'])}）
                <ul>
                  {(r.taskSheet['steps'] as string[] | undefined)?.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {(r.status === 'PENDING' || (r.status === 'APPROVED' && r.rolledBackAt === null)) && (
            <footer className="yh-review-card-footer">
              <span>仅作用于教学沙盒</span>
              {r.status === 'PENDING' ? (
                <>
                  <BeautifulButton type="button" size="sm" variant="secondary" className="yh-review-danger-action" onClick={() => act(() => client.decide(r.planId, 'REJECTED'))}>
                    驳回（店长）
                  </BeautifulButton>
                  <BeautifulButton type="button" size="sm" variant="primary" onClick={() => act(() => client.decide(r.planId, 'APPROVED'))}>
                    批准（店长）
                  </BeautifulButton>
                </>
              ) : (
                <BeautifulButton type="button" size="sm" variant="secondary" className="yh-review-danger-action" onClick={() => act(() => client.rollback(r.planId))}>
                  回滚本次批准
                </BeautifulButton>
              )}
            </footer>
          )}
        </article>
      ))}
      {error !== null && <ReviewNotice tone="danger">{error}</ReviewNotice>}
    </section>
  );
}
