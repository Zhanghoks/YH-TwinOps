/** YH 全店运营工作台（白膜演示）：场景 + 信号注入 + Agent + 三方案仿真 + 审批沙盒。 */
import { useEffect, useMemo, useState } from 'react';
import { projectTwinState } from '@yh/twin-state';
import { createAgentTools, DEFAULT_AGENT_SEED } from '@yh/agent/tools';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
import { INJECT_LABELS } from './synthetic';
import { DEMO_AT, layout } from './data';
import { useWorkbench, type ViewLayer } from './state';
import { createApprovalsClient, type ApprovalsClient } from './api';
import { Scene, type AssetManifest } from './scene/Scene';
import { SelectionInfo } from './ui/SelectionInfo';
import { AlertsPanel } from './ui/AlertsPanel';
import { AgentPanel } from './ui/AgentPanel';
import { ComparePanel } from './ui/ComparePanel';
import { ApprovalsPanel } from './ui/ApprovalsPanel';

type Tab = 'alerts' | 'agent' | 'compare' | 'approvals';

const TABS: { key: Tab; label: string }[] = [
  { key: 'alerts', label: '告警中心' },
  { key: 'agent', label: '门店助手' },
  { key: 'compare', label: '方案对比' },
  { key: 'approvals', label: '审批' },
];

const LAYERS: { key: ViewLayer; label: string }[] = [
  { key: 'none', label: '白膜' },
  { key: 'queue', label: '排队' },
  { key: 'traffic', label: '客流' },
  { key: 'coverage', label: '数据覆盖' },
];

interface RegistryFile {
  assets?: { assetId: string; file: string; status: string; role?: string }[];
}

function useAssetManifest(): AssetManifest {
  const [manifest, setManifest] = useState<AssetManifest>({ approved: new Map() });
  useEffect(() => {
    // 登记台账是换皮的唯一依据：只有 approved 资产才允许加载 GLB。
    const readRegistry = async (): Promise<void> => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}registry.json`);
        if (!res.ok) return;
        const registry = (await res.json()) as RegistryFile;
        if (registry.assets === undefined) return;
        const ok = registry.assets.filter((a) => a.status === 'approved');
        const approved = new Map(ok.map((a) => [a.assetId, `${import.meta.env.BASE_URL}${a.file}`]));
        const shell = ok.find((a) => a.role === 'store-shell');
        setManifest({ approved, shellUrl: shell === undefined ? undefined : `${import.meta.env.BASE_URL}${shell.file}` });
      } catch {
        setManifest({ approved: new Map() });
      }
    };
    void readRegistry();
  }, []);
  return manifest;
}

export function App(): React.JSX.Element {
  const signals = useWorkbench((s) => s.signals);
  const inject = useWorkbench((s) => s.inject);
  const layer = useWorkbench((s) => s.layer);
  const setLayer = useWorkbench((s) => s.setLayer);
  const [tab, setTab] = useState<Tab>('alerts');
  const [client, setClient] = useState<ApprovalsClient | null>(null);
  const [approvalsRefresh, setApprovalsRefresh] = useState(0);
  const manifest = useAssetManifest();

  useEffect(() => {
    createApprovalsClient().then(setClient);
  }, []);

  const snapshot = useMemo(() => projectTwinState(signals, layout, DEMO_AT), [signals]);
  const tools = useMemo(() => createAgentTools({ snapshot, signals }), [snapshot, signals]);
  const criticalCount = snapshot.alerts.filter((a) => a.severity === 'CRITICAL').length;

  return (
    <div className="workbench">
      <header className="topbar">
        <div className="topbar-title">
          <strong>YH-TwinOps 全店运营工作台</strong>
          <span className="tag-synthetic">合成教学演示 · 非永辉官方系统 · 无真实数据</span>
          <span className="tag-engine">回答引擎：本地规则（离线）</span>
          <span className="tag-time">情景时刻 {DEMO_AT.replace('T', ' ').replace('Z', '')}（18:00 高峰）</span>
        </div>
        <div className="topbar-actions">
          {Object.entries(INJECT_LABELS).map(([kind, label]) => (
            <button key={kind} className="inject" onClick={() => inject(kind as 'produce-traffic' | 'checkout-arrivals')}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="main">
        <div className="canvas-wrap">
          <div className="layer-bar">
            {/* 视觉图层切换：ui-sdk SegmentedControl（radio 语义，方向键可换挡） */}
            <SegmentedControl aria-label="视觉图层" value={layer} onValueChange={(next) => setLayer((next ?? 'none') as ViewLayer)}>
              <SegmentedControlIndicator />
              {LAYERS.map((l) => (
                <SegmentedControlItem key={l.key} value={l.key}>
                  {l.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>
          <Scene snapshot={snapshot} layout={layout} manifest={manifest} />
        </div>

        <aside className="sidebar">
          <div className="selection-block">
            <SelectionInfo snapshot={snapshot} />
          </div>
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? 'tab-active' : ''} onClick={() => setTab(t.key)}>
                {t.label}
                {t.key === 'alerts' && snapshot.alerts.length > 0 && (
                  <span className={`badge ${criticalCount > 0 ? 'badge-critical' : 'badge-warn'}`}>{snapshot.alerts.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="tab-body">
            {tab === 'alerts' && <AlertsPanel snapshot={snapshot} />}
            {tab === 'agent' && <AgentPanel tools={tools} />}
            {tab === 'compare' && (
              <ComparePanel tools={tools} snapshot={snapshot} seed={DEFAULT_AGENT_SEED} client={client} onProposed={() => setTab('approvals')} />
            )}
            {tab === 'approvals' && (
              <ApprovalsPanel client={client} refreshKey={approvalsRefresh} onRecordsChanged={() => setApprovalsRefresh((n) => n + 1)} />
            )}
          </div>
          <footer className="statusbar">
            信号 {snapshot.coverage.totalSignals} 条（合成 {snapshot.coverage.syntheticSignals}）· 快照 {snapshot.snapshotId} · 审批沙盒：
            {client === null ? '连接中' : client.mode === 'api' ? 'API 已连接' : '本地降级'}
          </footer>
        </aside>
      </div>
    </div>
  );
}
