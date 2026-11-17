/** YH 全店运营工作台（白膜演示）：场景 + 可调宽 Agent 对话框（对话 / 告警 / 方案 / 审批）。 */
import { useEffect, useMemo, useState } from 'react';
import { projectTwinState } from '@yh/twin-state';
import { createAgentTools, DEFAULT_AGENT_SEED } from '@yh/agent/tools';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui-sdk/react/tooltip';
import { Resizable, ResizableHandle, ResizablePanel } from '@ui-sdk/react/resizable';
import { INJECT_LABELS } from './synthetic';
import { DEMO_AT, layout as baselineLayout } from './data';
import { auditStoreLayout } from './scene/layoutAudit';
import { generatePlanningLayout } from './scene/planningLayout';
import { useWorkbench, type ViewLayer } from './state';
import { createApprovalsClient, fetchAgentStatus, type ApprovalsClient } from './api';
import { SceneBoundary } from './scene/SceneBoundary';
import { Scene, type SceneMode, type AssetManifest } from './scene/Scene';
import { AgentShell, type AgentView } from './ui/AgentShell';

const LAYERS: { key: ViewLayer; label: string }[] = [
  { key: 'none', label: '无叠加' },
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
  const [sceneMode, setSceneMode] = useState<SceneMode>('detail');
  const [cameraView, setCameraView] = useState<'overview' | 'top' | 'entrance'>('overview');
  const [cameraRevision, setCameraRevision] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [showLayoutReview, setShowLayoutReview] = useState(false);
  const select = useWorkbench((s) => s.select);
  const planningResult = useMemo(() => {
    try { return generatePlanningLayout(baselineLayout); } catch { return null; }
  }, []);
  const layout = planning && planningResult ? planningResult.layout : baselineLayout;
  const layoutAudit = useMemo(() => auditStoreLayout(layout), [layout]);
  const baselineAudit = useMemo(() => auditStoreLayout(baselineLayout), []);
  const reviewedGaps = [...layoutAudit.narrowGaps].sort((a, b) => a.gapM - b.gapM).slice(0, 5);
  const changePlan = (next: boolean): void => {
    setPlanning(next); setSceneMode('detail'); setLayer('none'); select(null);
    setCameraView('top'); setCameraRevision((n) => n + 1);
  };

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

  const snapshot = useMemo(() => projectTwinState(signals, layout, DEMO_AT), [signals, layout]);
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
              <SegmentedControl aria-label="模型表现" value={sceneMode} onValueChange={(next) => { if (next === 'detail' || next === 'shell' || next === 'white') setSceneMode(next); }}>
                <SegmentedControlIndicator />
                <SegmentedControlItem value="detail">精细模型</SegmentedControlItem>
                <SegmentedControlItem value="shell" disabled={planning || manifest.shellUrl === undefined}>原始外壳</SegmentedControlItem>
                <SegmentedControlItem value="white">白膜</SegmentedControlItem>
              </SegmentedControl>
              <SegmentedControl aria-label="视觉图层" value={layer} onValueChange={(next) => setLayer((next ?? 'none') as ViewLayer)}>
                <SegmentedControlIndicator />
                {LAYERS.map((l) => (
                  <SegmentedControlItem key={l.key} value={l.key}>
                    {l.label}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </div>
            {showLayoutReview && <section className="layout-review" aria-label="布局几何检查">
              <h3>布局几何检查 · 合成规划</h3>
              <div className="layout-review-actions">
                <button type="button" aria-pressed={!planning} onClick={() => changePlan(false)}>原型基线</button>
                <button type="button" aria-pressed={planning} disabled={!planningResult} onClick={() => changePlan(true)}>规划候选</button>
              </div>
              <p>{planning ? '独立候选，未批准；探索性重排固定标记设施，未覆盖基线。' : '原型设施位置保留。检查值仅用于几何审视。'}</p>
              <dl><dt>实体重叠 / 越门店界</dt><dd>{layoutAudit.overlapPairs.length} / {layoutAudit.outsideStoreIds.length}</dd>
                <dt>近邻间隙小于 1 m</dt><dd>{layoutAudit.narrowGaps.length} 对（基线 {baselineAudit.narrowGaps.length}）</dd>
                <dt>设施超出所属语义分区</dt><dd>{layoutAudit.outsideZoneFixtureIds.length} 个（基线 {baselineAudit.outsideZoneFixtureIds.length}）</dd></dl>
              {planning && planningResult && <p>重排 {planningResult.report.movedFixtureCount} 个设施；中央预留 {planningResult.report.centralAisleWidthM} m。ID、尺寸与数据关联保留。</p>}
              {reviewedGaps.map((gap) => <button className="gap-row" type="button" key={gap.fixtureIds.join('-')} onClick={() => select({kind: 'fixture', id: gap.fixtureIds[0]})}>{gap.fixtureIds.join(' / ')}：{gap.gapM.toFixed(2)} m · 定位</button>)}
              <p className="layout-review-caution">近邻间隙不等于通道净宽。入口为假设；尚未验证通达、消防、无障碍或客流收益。数据图层不是此候选的仿真结果。</p>
            </section>}
            <div className="scene-controls">
              <button type="button" onClick={() => { setCameraView('overview'); setCameraRevision((n) => n + 1); }}>全店视角</button>
              <button type="button" onClick={() => { setCameraView('top'); setCameraRevision((n) => n + 1); }}>俯视布局</button>
              <button type="button" onClick={() => { setCameraView('entrance'); setCameraRevision((n) => n + 1); }}>入口视角</button>
              <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels((v) => !v)}>{showLabels ? '隐藏分区' : '显示分区'}</button>
              <button type="button" aria-expanded={showLayoutReview} onClick={() => setShowLayoutReview((v) => !v)}>布局检查</button>
              <span>拖动旋转 · 滚轮缩放 · 点击设施</span>
            </div>
            <div className="scene-mode-note">{planning && '规划候选 · 未批准 · 数据非候选仿真 · '}{sceneMode === 'detail' ? `合成教学布局 ${layout.widthM}×${layout.depthM} m · 商品为装饰，不代表库存` : sceneMode === 'shell' ? '已登记原始外壳 · 基线未修改' : '布局白膜 · 设施尺寸来自布局数据'}</div>
            <SceneBoundary><Scene snapshot={snapshot} layout={layout} manifest={manifest} mode={sceneMode} cameraView={cameraView} cameraRevision={cameraRevision} showLabels={showLabels} fixedCenter={planning ? [0, 0] : undefined} /></SceneBoundary>
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
