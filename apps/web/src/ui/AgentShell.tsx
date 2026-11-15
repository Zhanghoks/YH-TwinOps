/**
 * 右侧统一 Agent 对话框壳：选中上下文 + 工具页签 + 对话/告警/方案/审批 + 状态栏。
 * 整栏作为助手工作区；告警/方案/审批是对话框内工具视图，不是并列独立侧栏。
 */
import { Separator } from '@ui-sdk/react/separator';
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';
import type { AgentTools } from '@yh/agent/tools';
import type { StoreLayout, TwinSignal, TwinSnapshot } from '@yh/contracts';
import type { ApprovalsClient } from '../api';
import { SelectionInfo } from './SelectionInfo';
import { AlertsPanel } from './AlertsPanel';
import { AgentPanel } from './AgentPanel';
import { ComparePanel } from './ComparePanel';
import { ApprovalsPanel } from './ApprovalsPanel';

export type AgentView = 'agent' | 'alerts' | 'compare' | 'approvals';

const VIEWS: { key: AgentView; label: string }[] = [
  { key: 'agent', label: '门店助手' },
  { key: 'alerts', label: '告警中心' },
  { key: 'compare', label: '方案对比' },
  { key: 'approvals', label: '审批' },
];

export interface AgentShellProps {
  view: AgentView;
  onViewChange: (view: AgentView) => void;
  snapshot: TwinSnapshot;
  tools: AgentTools;
  signals: TwinSignal[];
  layout: StoreLayout;
  at: string;
  seed: number;
  client: ApprovalsClient | null;
  approvalsRefresh: number;
  onApprovalsChanged: () => void;
  onProposed: () => void;
}

export function AgentShell({
  view,
  onViewChange,
  snapshot,
  tools,
  signals,
  layout,
  at,
  seed,
  client,
  approvalsRefresh,
  onApprovalsChanged,
  onProposed,
}: AgentShellProps): React.JSX.Element {
  const criticalCount = snapshot.alerts.filter((a) => a.severity === 'CRITICAL').length;

  return (
    <aside className="agent-shell" aria-label="门店运营 Agent 对话框">
      <header className="agent-shell-head">
        <div>
          <h2 className="agent-shell-title">门店运营 Agent</h2>
          <p className="panel-note">对话诊断 · 告警证据 · 方案仿真 · 人审沙盒（合成教学，非永辉官方）</p>
        </div>
      </header>

      <div className="agent-shell-context">
        <SelectionInfo snapshot={snapshot} />
      </div>

      <Separator />

      <Tabs
        className="agent-tabs"
        value={view}
        onValueChange={(next) => {
          if (next === 'agent' || next === 'alerts' || next === 'compare' || next === 'approvals') onViewChange(next);
        }}
      >
        <TabsList aria-label="Agent 工具视图" className="agent-tabs-list">
          <TabsIndicator />
          {VIEWS.map((v) => (
            <TabsTab key={v.key} value={v.key}>
              {v.label}
              {v.key === 'alerts' && snapshot.alerts.length > 0 && (
                <span className={`badge ${criticalCount > 0 ? 'badge-critical' : 'badge-warn'}`}>{snapshot.alerts.length}</span>
              )}
            </TabsTab>
          ))}
        </TabsList>
        <TabsPanel value="agent" className="agent-shell-body">
          <AgentPanel tools={tools} signals={signals} layout={layout} at={at} />
        </TabsPanel>
        <TabsPanel value="alerts" className="agent-shell-body">
          <AlertsPanel snapshot={snapshot} />
        </TabsPanel>
        <TabsPanel value="compare" className="agent-shell-body">
          <ComparePanel tools={tools} snapshot={snapshot} seed={seed} client={client} onProposed={onProposed} />
        </TabsPanel>
        <TabsPanel value="approvals" className="agent-shell-body">
          <ApprovalsPanel client={client} refreshKey={approvalsRefresh} onRecordsChanged={onApprovalsChanged} />
        </TabsPanel>
      </Tabs>

      <footer className="statusbar">
        信号 {snapshot.coverage.totalSignals} 条（合成 {snapshot.coverage.syntheticSignals}）· 快照 {snapshot.snapshotId} · 审批沙盒：
        {client === null ? '连接中' : client.mode === 'api' ? 'API 已连接' : '本地降级'}
      </footer>
    </aside>
  );
}
