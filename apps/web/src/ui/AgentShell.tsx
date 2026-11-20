/**
 * 右侧统一 Agent 对话框壳：选中上下文 + 工具页签 + 对话/告警/方案/审批 + 状态栏。
 * 整栏作为助手工作区；告警/方案/审批是对话框内工具视图，不是并列独立侧栏。
 */
import { Bot, MessagesSquare, Bell, GitCompareArrows, ShieldCheck } from 'lucide-react';
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';
import type { AgentTools } from '@yh/agent/tools';
import type { MerchandisingSnapshot, MerchandisingSubmission, StoreLayout, TwinSignal, TwinSnapshot } from '@yh/contracts';
import type { ApprovalsClient } from '../api';
import { SelectionInfo } from './SelectionInfo';
import { AlertsPanel } from './AlertsPanel';
import { AgentPanel } from './AgentPanel';
import { ComparePanel } from './ComparePanel';
import { ApprovalsPanel } from './ApprovalsPanel';

export type AgentView = 'agent' | 'alerts' | 'compare' | 'approvals';

const VIEWS: { key: AgentView; label: string; icon: typeof Bot }[] = [
  { key: 'agent', label: '门店助手', icon: MessagesSquare },
  { key: 'alerts', label: '告警中心', icon: Bell },
  { key: 'compare', label: '方案对比', icon: GitCompareArrows },
  { key: 'approvals', label: '审批', icon: ShieldCheck },
];

export interface AgentShellProps {
  view: AgentView;
  onViewChange: (view: AgentView) => void;
  snapshot: TwinSnapshot;
  tools: AgentTools;
  signals: TwinSignal[];
  layout: StoreLayout;
  merchandising?: MerchandisingSnapshot;
  merchandisingSubmission?: MerchandisingSubmission;
  selectedSlotId?: string;
  onSelectSlot?: (slotId: string) => void;
  onInjectStock?: (sku: string, fixtureId: string) => void;
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
  merchandising,
  merchandisingSubmission,
  selectedSlotId,
  onSelectSlot,
  onInjectStock,
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
        <div className="ba-shell-identity"><span className="ba-shell-mark"><Bot size={19} strokeWidth={1.7} aria-hidden="true"/></span><div><p className="ba-shell-eyebrow">YH TWINOPS</p><h2 className="agent-shell-title">门店运营 Agent</h2></div><span className="ba-shell-demo">教学沙盒</span></div>
      </header>

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
              <v.icon size={14} aria-hidden="true"/><span>{v.label}</span>
              {v.key === 'alerts' && snapshot.alerts.length > 0 && (
                <span className={`badge ${criticalCount > 0 ? 'badge-critical' : 'badge-warn'}`}>{snapshot.alerts.length}</span>
              )}
            </TabsTab>
          ))}
        </TabsList>
        <TabsPanel value="agent" className="agent-shell-body">
          <AgentPanel tools={tools} signals={signals} layout={layout} at={at} merchandisingSubmission={merchandisingSubmission} />
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
        <details className="ba-scene-details"><summary>场景与数据{selectedSlotId ? ' · 已选货位' : ''} · {snapshot.coverage.totalSignals} 条信号</summary><div className="ba-scene-popover"><SelectionInfo snapshot={snapshot} layout={layout} merchandising={merchandising} selectedSlotId={selectedSlotId} onSelectSlot={onSelectSlot} onInjectStock={onInjectStock} /><p>合成信号 {snapshot.coverage.syntheticSignals} 条 · {at}</p><p>建议与推演，不直接执行门店操作</p></div></details>
        <span title={`快照 ${snapshot.snapshotId}`}>审批沙盒：{client === null ? '连接中' : client.mode === 'api' ? 'API 已连接' : '本地降级'}</span>
      </footer>
    </aside>
  );
}
