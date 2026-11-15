/** YH 全店运营工作台（白膜演示）：场景 + 可调宽 Agent 对话框（对话 / 告警 / 方案 / 审批）。 */
import { useEffect, useMemo, useState } from 'react';
import { projectTwinState } from '@yh/twin-state';
import { createAgentTools, DEFAULT_AGENT_SEED } from '@yh/agent/tools';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui-sdk/react/tooltip';
import { Resizable, ResizableHandle, ResizablePanel } from '@ui-sdk/react/resizable';
import { INJECT_LABELS } from './synthetic';
import { DEMO_AT, layout } from './data';
import { useWorkbench, type ViewLayer } from './state';
import { createApprovalsClient, fetchAgentStatus, type ApprovalsClient } from './api';
import { Scene, type AssetManifest } from './scene/Scene';
import { AgentShell, type AgentView } from './ui/AgentShell';

const LAYERS: { key: ViewLayer; label: string }[] = [
  { key: 'none', label: '白膜' },
  { key: 'queue', label: '排队' },
  { key: 'traffic', label: '客流' },
  { key: 'coverage', label: '数据覆盖' },
];

const INJECT_SHORT: Record<'produce-traffic' | 'checkout-arrivals', string> = {
  'produce-traffic': '蔬果客流',
  'checkout-arrivals': '收银到达',
};

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
  const [view, setView] = useState<AgentView>('agent');
  const [client, setClient] = useState<ApprovalsClient | null>(null);
  const [engineLabel, setEngineLabel] = useState('探测引擎…');
  const [approvalsRefresh, setApprovalsRefresh] = useState(0);
  const manifest = useAssetManifest();

  useEffect(() => {
    createApprovalsClient().then(setClient);
  }, []);

  useEffect(() => {
    void fetchAgentStatus().then((status) => {
      if (status === null) {
        setEngineLabel('离线规则');
        return;
      }
      setEngineLabel(status.engine === 'pi-llm' ? `pi · ${status.model}` : '本地规则');
    });
  }, []);

  const snapshot = useMemo(() => projectTwinState(signals, layout, DEMO_AT), [signals]);
  const tools = useMemo(() => createAgentTools({ snapshot, signals }), [snapshot, signals]);

  return (
    <div className="workbench">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">YH</span>
          <div className="brand-copy">
            <strong className="brand-name">YH-TwinOps 全店运营工作台</strong>
            <span className="brand-meta">合成教学演示 · 非永辉官方系统 · 无真实数据</span>
          </div>
        </div>

        <div className="topbar-end">
          <div className="topbar-status">
            <span className="status-kicker">情景</span>
            <span className="status-value">18:00 高峰</span>
            <span className="status-engine">{engineLabel}</span>
          </div>
          <div className="topbar-actions">
            {(Object.keys(INJECT_SHORT) as Array<keyof typeof INJECT_SHORT>).map((kind) => (
              <Tooltip key={kind}>
                <TooltipTrigger
                  className="inject"
                  aria-label={INJECT_LABELS[kind]}
                  onClick={() => inject(kind)}
                >
                  {INJECT_SHORT[kind]}
                </TooltipTrigger>
                <TooltipContent>{INJECT_LABELS[kind]}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </header>

      <Resizable className="main" autoSaveId="yh-workbench-split">
        <ResizablePanel id="yh-scene" className="scene-pane" defaultSize={68} minSize={42}>
          <div className="canvas-wrap">
            <div className="layer-bar">
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
        </ResizablePanel>

        <ResizableHandle aria-label="调整场景与 Agent 对话框宽度" className="workbench-split-handle" />

        <ResizablePanel id="yh-agent" className="agent-pane" defaultSize={32} minSize={24} maxSize={48}>
          <AgentShell
            view={view}
            onViewChange={setView}
            snapshot={snapshot}
            tools={tools}
            signals={signals}
            layout={layout}
            at={DEMO_AT}
            seed={DEFAULT_AGENT_SEED}
            client={client}
            approvalsRefresh={approvalsRefresh}
            onApprovalsChanged={() => setApprovalsRefresh((n) => n + 1)}
            onProposed={() => setView('approvals')}
          />
        </ResizablePanel>
      </Resizable>
    </div>
  );
}
