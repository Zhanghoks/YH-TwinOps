import { useOperatingClock } from './useOperatingClock';
import { buildLiveOperatingScenario, liveOperatingSignals } from './operatingClock';
import { buildOperatingScenario, operatingSignals, type OperatingDay } from './operatingModel';
import { OperatingAnalytics } from './ui/OperatingAnalytics';
import { OperationsDashboard } from './ui/OperationsDashboard';
import type { SimulatedWeather } from './scene/weatherModel';
import { COMPONENT_SAMPLES, type ComponentSampleId } from './scene/componentCatalog';
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
import { generatePlanningLayout, buildReferenceDisplayFixtures } from './scene/planningLayout';
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
  const incidentSignals = useWorkbench((s) => s.signals);
  const [operatingDay,setOperatingDay] = useState<OperatingDay>('weekday');
  const [operatingHour,setOperatingHour] = useState(18);
  const [incidentMode,setIncidentMode] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'scene' | 'analytics'>('scene');
  const clock = useOperatingClock();
  const [followClock, setFollowClock] = useState(true);
  const liveOperating = useMemo(() => buildLiveOperatingScenario(clock), [clock]);
  const operating = useMemo(() => followClock ? liveOperating : buildOperatingScenario(operatingDay, operatingHour), [followClock, liveOperating, operatingDay, operatingHour]);
  const chooseDay = (day: OperatingDay) => { setOperatingDay(day); setOperatingHour(operating.hour); setFollowClock(false); };
  const chooseHour = (hour: number) => { setOperatingDay(operating.day); setOperatingHour(hour); setFollowClock(false); };
  const signals = useMemo(()=>incidentMode ? incidentSignals : followClock ? liveOperatingSignals(liveOperating) : operatingSignals(operating),[incidentMode,incidentSignals,followClock,liveOperating,operating]);
  const scenarioAt = incidentMode ? DEMO_AT : operating.at;
  const operatingOccupancy = useMemo(()=>incidentMode ? undefined : Object.fromEntries(operating.zones.map(z=>[z.zoneId,z.occupancy])),[incidentMode,operating]);
  const inject = useWorkbench((s) => s.inject);
  const layer = useWorkbench((s) => s.layer);
  const setLayer = useWorkbench((s) => s.setLayer);
  const [view, setView] = useState<AgentView>('agent');
  const [client, setClient] = useState<ApprovalsClient | null>(null);
  const [engineLabel, setEngineLabel] = useState('探测引擎…');
  const [approvalsRefresh, setApprovalsRefresh] = useState(0);
  const manifest = useAssetManifest();
  const [weather,setWeather]=useState<SimulatedWeather>('sunny');
  const [rainPaused,setRainPaused]=useState(false);
  const [cityPaused,setCityPaused]=useState(false);
  const [showCustomers,setShowCustomers]=useState(true);
  const [stocked,setStocked]=useState(true);
  const [customersPaused,setCustomersPaused]=useState(false);
  const [economy,setEconomy]=useState(true);
  const [cloudQuality,setCloudQuality]=useState<'off'|'low'|'high'>('low');
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{const q=window.matchMedia?.('(prefers-reduced-motion: reduce)');if(!q)return;const update=()=>setReducedMotion(q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update);},[]);
  const [componentId, setComponentId] = useState<ComponentSampleId | undefined>();
  const [sceneMode, setSceneMode] = useState<SceneMode>('detail');
  const [cameraView, setCameraView] = useState<'overview' | 'top' | 'entrance' | 'site' | 'sky' | 'urbanInterior'>('overview');
  const [cameraRevision, setCameraRevision] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [modelFocused, setModelFocused] = useState(false);
  // Keep the user-reviewed dense reference scene as the entry view on every reload.
  const [planning, setPlanning] = useState(true);
  const [showLayoutReview, setShowLayoutReview] = useState(false);
  const select = useWorkbench((s) => s.select);
  const planningResult = useMemo(() => {
    try { return generatePlanningLayout(baselineLayout); } catch { return null; }
  }, []);
  const referenceDisplayCount = useMemo(() => planningResult ? buildReferenceDisplayFixtures(planningResult.layout).length : 0, [planningResult]);
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

  const snapshot = useMemo(() => projectTwinState(signals, layout, scenarioAt), [signals, layout, scenarioAt]);
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
          <SegmentedControl className="workspace-view-toggle" aria-label="工作台视图" value={workspaceView} onValueChange={value => { if (value === 'scene' || value === 'analytics') setWorkspaceView(value); }}>
            <SegmentedControlItem value="scene">3D 工作台</SegmentedControlItem>
            <SegmentedControlItem value="analytics">经营看板</SegmentedControlItem>
          </SegmentedControl>
          <div className="topbar-status">
            <span className="status-kicker">情景</span>
            <span className="status-value">{incidentMode ? '18:00 异常教学' : `${followClock ? '随钟模拟' : '手动回看'} · ${operating.day==='weekday'?'工作日':'周末'} ${operating.hour}:00`}</span>
            <span className="status-engine">{engineLabel}</span>
          </div>
          <div className="topbar-actions">
            {(Object.keys(INJECT_SHORT) as Array<keyof typeof INJECT_SHORT>).map((kind) => (
              <Tooltip key={kind}>
                <TooltipTrigger
                  className="inject"
                  aria-label={INJECT_LABELS[kind]}
                  onClick={() => { setIncidentMode(true); inject(kind); }}
                >
                  {INJECT_SHORT[kind]}
                </TooltipTrigger>
                <TooltipContent>{INJECT_LABELS[kind]}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </header>
      <OperationsDashboard scenario={operating} onDayChange={chooseDay} onHourChange={chooseHour} followClock={followClock} onResumeClock={() => setFollowClock(true)} incidentMode={incidentMode} onIncidentModeChange={setIncidentMode} />

      <div className="analytics-view" hidden={workspaceView !== 'analytics'}>
        {incidentMode ? <section className="analytics-incident"><h2>异常教学信号独立运行</h2><p>当前不展示经营模拟图表，避免与异常信号混用。返回经营模拟可继续查看此前选择的日期与时段。</p><button onClick={() => setIncidentMode(false)}>查看经营模拟看板</button></section> : <OperatingAnalytics scenario={operating} onHourChange={chooseHour} />}
      </div>
      <Resizable className={`main${workspaceView === 'analytics' ? ' workspace-hidden' : ''}${modelFocused ? ' model-focused' : ''}`} autoSaveId="yh-workbench-split">
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
              <SegmentedControl aria-label="货架陈列" value={stocked ? 'stocked' : 'empty'} onValueChange={next => { if (next === 'stocked' || next === 'empty') setStocked(next === 'stocked'); }}>
                <SegmentedControlIndicator />
                <SegmentedControlItem value="empty">空货架</SegmentedControlItem>
                <SegmentedControlItem value="stocked">填充商品</SegmentedControlItem>
              </SegmentedControl>
            </div>
            {!componentId && <div className="weather-controls" aria-label="模拟天气">
              <span>天气模拟 · 非实时</span>
              {(['sunny','overcast','rain'] as const).map((key,i)=><button type="button" key={key} aria-pressed={weather===key} onClick={()=>setWeather(key)}>{['晴','阴','雨'][i]}</button>)}
              <button type="button" aria-pressed={cityPaused} onClick={()=>setCityPaused(v=>!v)}>{cityPaused?'启动车流':'暂停车流'}</button>
              <button type="button" onClick={()=>setEconomy(v=>!v)}>{economy?'画质：节能':'画质：精细'}</button>
              <label>云 <select aria-label="体积云质量" value={cloudQuality} onChange={e=>setCloudQuality(e.target.value as 'off'|'low'|'high')}><option value="off">关闭</option><option value="low">节能体积</option><option value="high">精细体积</option></select></label>
              {weather==='rain'&&<><button type="button" aria-pressed={rainPaused} onClick={()=>setRainPaused(v=>!v)}>{rainPaused?'恢复雨效':'暂停雨效'}</button><small>{reducedMotion?'减少动态：静态雨效':rainPaused?'雨效已暂停':'室外雨效 · 约30fps刷新'}</small></>}
            </div>}
            {!componentId && sceneMode === 'detail' && <div className="customer-controls" aria-label="合成顾客演示">
              <span>28人动作演示 · 不等于经营人数</span>
              <button type="button" aria-pressed={showCustomers} onClick={()=>setShowCustomers(v=>!v)}>{showCustomers?'隐藏顾客':'显示顾客'}</button>
              <button type="button" disabled={!showCustomers || reducedMotion} aria-pressed={customersPaused || reducedMotion} onClick={()=>setCustomersPaused(v=>!v)}>{customersPaused?'继续行走':'暂停行走'}</button>
              {reducedMotion && <small>减少动态：静态顾客</small>}
            </div>}
            {showLayoutReview && <section className="layout-review" aria-label="布局几何检查">
              <h3>布局几何检查 · 合成规划</h3>
              <div className="layout-review-actions">
                <button type="button" aria-pressed={!planning} onClick={() => changePlan(false)}>原型基线</button>
                <button type="button" aria-pressed={planning} disabled={!planningResult} onClick={() => changePlan(true)}>按图候选</button>
              </div>
              <p>{planning ? '按用户概念分布图重建，未批准；130×100m外框，北上南下。未覆盖基线。' : '原型设施位置保留。检查值仅用于几何审视。'}</p>
              <dl><dt>实体重叠 / 越门店界</dt><dd>{layoutAudit.overlapPairs.length} / {layoutAudit.outsideStoreIds.length}</dd>
                <dt>近邻间隙小于 1 m</dt><dd>{layoutAudit.narrowGaps.length} 对（基线 {baselineAudit.narrowGaps.length}）</dd>
                <dt>设施超出所属语义分区</dt><dd>{layoutAudit.outsideZoneFixtureIds.length} 个（基线 {baselineAudit.outsideZoneFixtureIds.length}）</dd></dl>
              {planning && planningResult && <p>重排 {planningResult.report.movedFixtureCount} 个设施；{planningResult.report.dimensionChangedFixtureCount} 个尺寸按图近似。设施 ID 与数据关联保留。另有 {referenceDisplayCount} 个按图补充陈列，仅作装饰，不可选中，不参与库存或仿真。</p>}
              {reviewedGaps.map((gap) => <button className="gap-row" type="button" key={gap.fixtureIds.join('-')} onClick={() => select({kind: 'fixture', id: gap.fixtureIds[0]})}>{gap.fixtureIds.join(' / ')}：{gap.gapM.toFixed(2)} m · 定位</button>)}
              <p className="layout-review-caution">近邻间隙不等于通道净宽。参考图非施工图，面积表与总计不一致；采用图面方向和相对位置，未实测。未验证消防或客流，数据不是候选仿真结果。</p>
            </section>}
            {componentId && <section className="layout-review" aria-label="组件独立检视">
              <h3>组件独立检视 · 参考设计样板</h3>
              <p>只检视单体，不写入门店布局或库存。空架/填充适用于09–11货架；其他柜台保持原样。</p>
              <div className="layout-review-actions" style={{flexWrap:'wrap'}}>{COMPONENT_SAMPLES.map(sample => <button type="button" key={sample.id} aria-pressed={componentId===sample.id} onClick={() => setComponentId(sample.id)}>{sample.name}</button>)}</div>
              <p>{COMPONENT_SAMPLES.find(s=>s.id===componentId)?.size.map(n=>Math.round(n*1000)).join(' × ')} mm · 参考图设计尺寸，非实测</p>
              <p>拖动旋转 · 滚轮缩放。新类型仅为独立样板，不自动放入门店。全部为未批准的合成设计。</p>
            </section>}
            <div className="scene-controls">
              <button type="button" onClick={() => { setCameraView('overview'); setCameraRevision((n) => n + 1); }}>全店视角</button>
              <button type="button" onClick={() => { setCameraView('top'); setCameraRevision((n) => n + 1); }}>俯视布局</button>
              <button type="button" onClick={() => { setCameraView('entrance'); setCameraRevision((n) => n + 1); }}>入口视角</button>
              <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels((v) => !v)}>{showLabels ? '隐藏分区' : '显示分区'}</button>
              <button type="button" aria-expanded={showLayoutReview} onClick={() => setShowLayoutReview((v) => !v)}>布局检查</button>
              <button type="button" aria-pressed={modelFocused} onClick={() => setModelFocused((v) => !v)}>{modelFocused ? '返回工作台' : '专注模型'}</button>
              <button type="button" aria-pressed={!!componentId} onClick={() => { setComponentId(v=>v ? undefined : 'vegetable'); setShowLayoutReview(false); }}> {componentId ? '返回门店' : '组件检视'}</button>
              <button type="button" onClick={() => { setComponentId(undefined); setCameraView('site'); setCameraRevision(n=>n+1); }}>场景全景</button>
              <button type="button" onClick={() => { setComponentId(undefined); setCameraView('sky'); setCameraRevision(n=>n+1); }}>城市天际线</button>
              <button type="button" onClick={() => { setComponentId(undefined); setCameraView('urbanInterior'); setCameraRevision(n=>n+1); }}>街区内部</button>
              <span>拖动旋转 · 滚轮缩放 · 点击设施</span>
            </div>
            <div className="scene-mode-note">{componentId ? '独立设计样板 · 未批准 · 不计入布局与库存' : <>{planning && '按图候选 · 尺寸推定 · 未批准 · 数据非候选仿真 · '}{sceneMode === 'detail' ? `合成教学布局 ${layout.widthM}×${layout.depthM} m · 商品为装饰，不代表库存 · ${stocked ? "货架已填充" : "仅货架结构（其他柜台不变）"}` : sceneMode === 'shell' ? '已登记原始外壳 · 基线未修改' : '布局白膜 · 设施尺寸来自布局数据'}</>}</div>
            <SceneBoundary><Scene stocked={stocked} operatingOccupancyLabel={followClock ? '模拟在场估算' : '平均在场估算'} active={workspaceView === 'scene'} operatingOccupancy={operatingOccupancy} showCustomers={showCustomers} customersPaused={customersPaused || reducedMotion} economy={economy} cityPaused={cityPaused || reducedMotion} cloudQuality={cloudQuality} weather={weather} reducedMotion={reducedMotion || rainPaused} componentId={componentId} snapshot={snapshot} layout={layout} manifest={manifest} mode={sceneMode} cameraView={cameraView} cameraRevision={cameraRevision} showLabels={showLabels} fixedCenter={planning ? [0, 0] : undefined} referenceRegions={planning && planningResult ? planningResult.report.referenceRegions : undefined} /></SceneBoundary>
          </div>
        </ResizablePanel>

        <ResizableHandle aria-label="调整场景与 Agent 对话框宽度" className="workbench-split-handle" />

        <ResizablePanel id="yh-agent" className="agent-pane" defaultSize={32} minSize={24} maxSize={48}>
          <AgentShell key={incidentMode ? 'incident' : followClock ? 'operating-live' : `operating-manual-${scenarioAt}`}
            view={view}
            onViewChange={setView}
            snapshot={snapshot}
            tools={tools}
            signals={signals}
            layout={layout}
            at={scenarioAt}
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
