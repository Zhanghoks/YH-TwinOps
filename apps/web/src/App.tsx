import {buildSameSkuFill,type SameSkuFillRequest} from './scene/sameSkuFill';
import { useOperatingClock } from './useOperatingClock';
import { buildLiveOperatingScenario, liveOperatingSignals } from './operatingClock';
import { buildOperatingScenario, operatingSignals, type OperatingDay } from './operatingModel';
import { OperatingAnalytics } from './ui/OperatingAnalytics';
import { ProductCatalog, type TrialPlacementCounts } from './ui/ProductCatalog';
import { buildProductPlacements } from './catalog/productPlacements';
import { OperationsDashboard } from './ui/OperationsDashboard';
import type { SimulatedWeather } from './scene/weatherModel';
import { COMPONENT_SAMPLES, type ComponentSampleId } from './scene/componentCatalog';
/** YH 全店运营工作台（白膜演示）：场景 + 可调宽 Agent 对话框（对话 / 告警 / 方案 / 审批）。 */
import { useEffect, useMemo, useState, useCallback, type KeyboardEvent } from 'react';
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
import { BeautifulButton } from './ui/beautiful/Button';
import { Box, ChartNoAxesCombined, Package, SlidersHorizontal, TriangleAlert } from 'lucide-react';

function closeDisclosure(details: HTMLDetailsElement) {
  details.open = false;
  details.querySelector('summary')?.focus();
}

function handleDisclosureKeys(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key === 'Escape' && event.currentTarget.open) {
    event.stopPropagation();
    closeDisclosure(event.currentTarget);
  }
}

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
  const [workspaceView, setWorkspaceView] = useState<'scene' | 'analytics' | 'products'>('scene');
  const catalogTrialCounts = useMemo(() => {
    if (workspaceView !== 'products') return undefined;
    try { return buildProductPlacements().reduce<TrialPlacementCounts>((counts, {sku}) => {
      counts[sku] = (counts[sku] ?? 0) + 1;
      return counts;
    }, {}); } catch { return undefined; }
  }, [workspaceView]);
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
  const [f032Trial,setF032Trial]=useState(false);
  const [pilotTrials,setPilotTrials]=useState<string[]>([]);
  const [fillRequest,setFillRequest]=useState<SameSkuFillRequest>();
  const effectivePilotTrials=useMemo(()=>fillRequest&&!pilotTrials.includes('F077')?[...pilotTrials,'F077']:pilotTrials,[fillRequest,pilotTrials]);
  const [customersPaused,setCustomersPaused]=useState(false);
  const [economy,setEconomy]=useState(true);
  const [cloudQuality,setCloudQuality]=useState<'off'|'low'|'high'>('low');
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{const q=window.matchMedia?.('(prefers-reduced-motion: reduce)');if(!q)return;const update=()=>setReducedMotion(q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update);},[]);
  const [componentId, setComponentId] = useState<ComponentSampleId | undefined>();
  const [sceneMode, setSceneMode] = useState<SceneMode>('detail');
  const [cameraView, setCameraView] = useState<'overview' | 'top' | 'entrance' | 'site' | 'sky' | 'urbanInterior' | 'f032' | 'F029' | 'F050' | 'F077' | 'F107' | 'F074' | 'F007' | 'F120'>('overview');
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
  const previewFill=useCallback((request:SameSkuFillRequest)=>{
    const f=planningResult?.layout.fixtures.find(f=>f.fixtureId==='F077');
    if(!f)return {count:0,skippedLevels:[],error:'密集版 F077 不可用'};
    const plan=buildSameSkuFill(f,request);
    return {count:plan.counts.products,skippedLevels:plan.skipped.map(s=>`${s.mountKey}: ${s.reason}`),error:plan.incompatibility ?? undefined};
  },[planningResult]);
  const applyFill=(request:SameSkuFillRequest)=>{
    const preview=previewFill(request);if(preview.error||!preview.count)return;
    setFillRequest({...request});setPlanning(true);setSceneMode('detail');setComponentId(undefined);
    setWorkspaceView('scene');
    setCameraView('F077');setCameraRevision(n=>n+1);select({kind:'fixture',id:'F077'});
  };
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
            <strong className="brand-name">YH-TwinOps <span>全店运营工作台</span></strong>
            <span className="brand-meta">合成教学演示 · 非永辉官方系统 · 无真实数据</span>
          </div>
        </div>

        <div className="topbar-end">
          <SegmentedControl className="workspace-view-toggle" aria-label="工作台视图" value={workspaceView} onValueChange={value => { if (value === 'scene' || value === 'analytics' || value === 'products') setWorkspaceView(value); }}>
            <SegmentedControlItem value="scene"><Box size={15} aria-hidden="true" />3D 孪生</SegmentedControlItem>
            <SegmentedControlItem value="analytics"><ChartNoAxesCombined size={15} aria-hidden="true" />经营看板</SegmentedControlItem>
            <SegmentedControlItem value="products"><Package size={15} aria-hidden="true" />商品目录</SegmentedControlItem>
          </SegmentedControl>
          <div className="topbar-status">
            <span className="status-kicker">情景</span>
            <span className="status-value">{incidentMode ? '18:00 异常教学' : `${followClock ? '随钟模拟' : '手动回看'} · ${operating.day==='weekday'?'工作日':'周末'} ${operating.hour}:00`}</span>
            <span className="status-engine">{engineLabel}</span>
          </div>
          <details className="topbar-actions" onKeyDown={handleDisclosureKeys}>
            <summary><TriangleAlert size={14} aria-hidden="true" /> 异常演示</summary>
            <div className="topbar-action-list">
              {(Object.keys(INJECT_SHORT) as Array<keyof typeof INJECT_SHORT>).map((kind) => (
                <Tooltip key={kind}>
                  <TooltipTrigger
                    className="inject"
                    aria-label={INJECT_LABELS[kind]}
                    onClick={(event) => {
                      setIncidentMode(true);
                      inject(kind);
                      const disclosure = event.currentTarget.closest('details');
                      if (disclosure) closeDisclosure(disclosure);
                    }}
                  >
                    {INJECT_SHORT[kind]}
                  </TooltipTrigger>
                  <TooltipContent>{INJECT_LABELS[kind]}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </details>
        </div>
      </header>
      <main className="analytics-view analytics-workspace" aria-label="经营看板页面" hidden={workspaceView !== 'analytics'}>
        {incidentMode
          ? <section className="analytics-incident">
              <h2>异常教学信号独立运行</h2>
              <p>当前不展示经营模拟图表，避免与异常信号混用。返回经营模拟可继续查看此前选择的日期与时段。</p>
              <BeautifulButton variant="accent" onClick={() => setIncidentMode(false)}>返回经营模拟</BeautifulButton>
            </section>
          : <OperatingAnalytics scenario={operating} onHourChange={chooseHour}
              controls={<OperationsDashboard scenario={operating} onDayChange={chooseDay} onHourChange={chooseHour}
                followClock={followClock} onResumeClock={() => setFollowClock(true)} incidentMode={incidentMode} onIncidentModeChange={setIncidentMode} />} />}
      </main>
      <div className="analytics-view" hidden={workspaceView !== 'products'}>
        <ProductCatalog trialCounts={catalogTrialCounts} fillRequest={fillRequest} previewFill={previewFill} onApplyFill={applyFill} onRevertFill={()=>setFillRequest(undefined)} />
      </div>
      <Resizable className={`main${workspaceView !== 'scene' ? ' workspace-hidden' : ''}${modelFocused ? ' model-focused' : ''}`} autoSaveId="yh-workbench-split">
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
              <SegmentedControl aria-label="货架陈列" value={(componentId?.startsWith('dimensioned-') || componentId?.startsWith('refrigeration-') || componentId?.startsWith('retail-')) ? 'empty' : stocked ? 'stocked' : 'empty'} onValueChange={next => { if (next === 'stocked' || next === 'empty') setStocked(next === 'stocked'); }}>
                <SegmentedControlIndicator />
                <SegmentedControlItem disabled={(componentId?.startsWith('dimensioned-') || componentId?.startsWith('refrigeration-') || componentId?.startsWith('retail-'))} value="empty">空货架</SegmentedControlItem>
                <SegmentedControlItem disabled={(componentId?.startsWith('dimensioned-') || componentId?.startsWith('refrigeration-') || componentId?.startsWith('retail-'))} value="stocked">填充商品</SegmentedControlItem>
              </SegmentedControl>
            </div>
            <details className="scene-settings" hidden={!!componentId} onKeyDown={handleDisclosureKeys}>
              <summary><SlidersHorizontal size={14} aria-hidden="true" /> 场景设置</summary>
              <div className="scene-settings-body">
                {planning && <section className="weather-controls" aria-label="F032局部试换">
                  <strong>F032 精选区 · 仅此设备组</strong>
                  <BeautifulButton size="xs" aria-pressed={f032Trial} onClick={()=>{setF032Trial(v=>!v);setSceneMode('detail');setCameraView('f032');setCameraRevision(n=>n+1);}}>{f032Trial ? '回退 F032 原版' : '试换 F032 新架'}</BeautifulButton>
                  <BeautifulButton size="xs" onClick={()=>{setSceneMode('detail');setCameraView('f032');setCameraRevision(n=>n+1);}}>定位 F032</BeautifulButton>
                  <span>{f032Trial && sceneMode==='detail' ? '试换中：3组定尺双面架 · 高度例外1.60m · 商品独立重挂' : f032Trial ? '试换已开启 · 精细模型可见' : '保持原版 · 可逆试换，不改运营数据'}</span>
                </section>}
                {planning && <section className="weather-controls" aria-label="分类局部试换">
                  <strong>分类试换 · 每点独立回退</strong>
                  {(['F029','F050','F077','F107','F074','F007','F120'] as const).map((id,i)=><BeautifulButton size="xs" key={id} disabled={id==='F077'&&!!fillRequest} aria-pressed={pilotTrials.includes(id)} onClick={()=>{setPilotTrials(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);setSceneMode('detail');setCameraView(id);setCameraRevision(n=>n+1);}}>{pilotTrials.includes(id)?'回退':'试换'} {id} {['果蔬','岛柜','食品','日化','风幕柜','鲜肉柜','收银'][i]}</BeautifulButton>)}
                  {fillRequest&&<BeautifulButton size="xs" onClick={()=>setFillRequest(undefined)}>撤回 F077 填充（还原此前试换开关）</BeautifulButton>}
                  <span>{fillRequest ? 'F077 同款填充临时启用 · 不改变其他点位与库存' : pilotTrials.length ? `${pilotTrials.join(' / ')} 已开启（精细模型可见）· F107为2300mm参数变体；商品为合成模型` : '默认旧版 · 不影响其他点位与经营数据'}</span>
                </section>}
                <section className="weather-controls" aria-label="模拟天气">
                  <strong>天气模拟 · 非实时</strong>
                  {(['sunny','overcast','rain'] as const).map((key,i)=><BeautifulButton size="xs" key={key} aria-pressed={weather===key} onClick={()=>setWeather(key)}>{['晴','阴','雨'][i]}</BeautifulButton>)}
                  <BeautifulButton size="xs" aria-pressed={cityPaused} onClick={()=>setCityPaused(v=>!v)}>{cityPaused?'启动车流':'暂停车流'}</BeautifulButton>
                  <BeautifulButton size="xs" onClick={()=>setEconomy(v=>!v)}>{economy?'画质：节能':'画质：精细'}</BeautifulButton>
                  <label>云 <select aria-label="体积云质量" value={cloudQuality} onChange={e=>setCloudQuality(e.target.value as 'off'|'low'|'high')}><option value="off">关闭</option><option value="low">节能体积</option><option value="high">精细体积</option></select></label>
                  {weather==='rain'&&<><BeautifulButton size="xs" aria-pressed={rainPaused} onClick={()=>setRainPaused(v=>!v)}>{rainPaused?'恢复雨效':'暂停雨效'}</BeautifulButton><small>{reducedMotion?'减少动态：静态雨效':rainPaused?'雨效已暂停':'室外雨效 · 约30fps刷新'}</small></>}
                </section>
                {sceneMode === 'detail' && <section className="customer-controls" aria-label="合成顾客演示">
                  <strong>28 人动作演示 · 不等于经营人数</strong>
                  <BeautifulButton size="xs" aria-pressed={showCustomers} onClick={()=>setShowCustomers(v=>!v)}>{showCustomers?'隐藏顾客':'显示顾客'}</BeautifulButton>
                  <BeautifulButton size="xs" disabled={!showCustomers || reducedMotion} aria-pressed={customersPaused || reducedMotion} onClick={()=>setCustomersPaused(v=>!v)}>{customersPaused?'继续行走':'暂停行走'}</BeautifulButton>
                  {reducedMotion && <small>减少动态：静态顾客</small>}
                </section>}
              </div>
            </details>
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
              {componentId.startsWith('retail-') && <p>空组件资产 · 外包尺度参考厂商样本，护边、内部结构和终端高度为设计取值。商品与人独立，不作为永辉实测或制造图。</p>}
              {componentId.startsWith('refrigeration-') && <p>空柜资产 · 外包尺寸参考制造商样本，内部为原创示意。玻璃、柜体与商品挂点分开；不表示冷量仿真或永辉实测。</p>}
              {componentId.startsWith('dimensioned-') && <p>定尺资产 · 仅空架。层面高度为设计取值，挂点已预留，未自动填充商品或替换全店货架；不作为承载或施工认证。</p>}
              <p>只检视单体，不写入门店布局或库存。空架/填充适用于09–11货架；其他柜台保持原样。</p>
              <div className="layout-review-actions" style={{flexWrap:'wrap'}}>{COMPONENT_SAMPLES.map(sample => <button type="button" key={sample.id} aria-pressed={componentId===sample.id} onClick={() => setComponentId(sample.id)}>{sample.name}</button>)}</div>
              <p>{COMPONENT_SAMPLES.find(s=>s.id===componentId)?.size.map(n=>Math.round(n*1000)).join(' × ')} mm · 参考图设计尺寸，非实测</p>
              <p>拖动旋转 · 滚轮缩放。新类型仅为独立样板，不自动放入门店。全部为未批准的合成设计。</p>
            </section>}
            <div className="scene-dock">
              <div className="scene-controls" role="group" aria-label="场景视角与检视">
                <BeautifulButton size="sm" variant="quiet" onClick={() => { setCameraView('overview'); setCameraRevision((n) => n + 1); }}>全店视角</BeautifulButton>
                <BeautifulButton size="sm" variant="quiet" onClick={() => { setCameraView('top'); setCameraRevision((n) => n + 1); }}>俯视布局</BeautifulButton>
                <BeautifulButton size="sm" variant="quiet" onClick={() => { setCameraView('entrance'); setCameraRevision((n) => n + 1); }}>入口视角</BeautifulButton>
                <BeautifulButton size="sm" variant="quiet" aria-pressed={showLabels} onClick={() => setShowLabels((v) => !v)}>{showLabels ? '隐藏分区' : '显示分区'}</BeautifulButton>
                <BeautifulButton size="sm" variant="quiet" aria-expanded={showLayoutReview} onClick={() => setShowLayoutReview((v) => !v)}>布局检查</BeautifulButton>
                <BeautifulButton size="sm" variant="quiet" aria-pressed={modelFocused} onClick={() => setModelFocused((v) => !v)}>{modelFocused ? '返回工作台' : '专注模型'}</BeautifulButton>
                <BeautifulButton size="sm" variant="quiet" aria-pressed={!!componentId} onClick={() => { setComponentId(v=>v ? undefined : 'vegetable'); setShowLayoutReview(false); }}> {componentId ? '返回门店' : '组件检视'}</BeautifulButton>
                <BeautifulButton size="sm" variant="quiet" onClick={() => { setComponentId(undefined); setCameraView('site'); setCameraRevision(n=>n+1); }}>场景全景</BeautifulButton>
                <BeautifulButton size="sm" variant="quiet" onClick={() => { setComponentId(undefined); setCameraView('sky'); setCameraRevision(n=>n+1); }}>城市天际线</BeautifulButton>
                <BeautifulButton size="sm" variant="quiet" onClick={() => { setComponentId(undefined); setCameraView('urbanInterior'); setCameraRevision(n=>n+1); }}>街区内部</BeautifulButton>
              </div>
              <div className="scene-mode-note">{componentId ? '独立设计样板 · 未批准 · 不计入布局与库存' : <>{planning && '按图候选 · 尺寸推定 · 未批准 · 数据非候选仿真 · '}{sceneMode === 'detail' ? `合成教学布局 ${layout.widthM}×${layout.depthM} m · 商品为装饰，不代表库存 · ${stocked ? "货架已填充" : "仅货架结构（其他柜台不变）"}` : sceneMode === 'shell' ? '已登记原始外壳 · 基线未修改' : '布局白膜 · 设施尺寸来自布局数据'}</>}</div>
            </div>
            <SceneBoundary><Scene fillRequest={planning ? fillRequest : undefined} pilotTrials={planning ? effectivePilotTrials : []} f032Trial={planning && f032Trial} stocked={stocked} operatingOccupancyLabel={followClock ? '模拟在场估算' : '平均在场估算'} active={workspaceView === 'scene'} operatingOccupancy={operatingOccupancy} showCustomers={showCustomers} customersPaused={customersPaused || reducedMotion} economy={economy} cityPaused={cityPaused || reducedMotion} cloudQuality={cloudQuality} weather={weather} reducedMotion={reducedMotion || rainPaused} componentId={componentId} snapshot={snapshot} layout={layout} manifest={manifest} mode={sceneMode} cameraView={cameraView} cameraRevision={cameraRevision} showLabels={showLabels} fixedCenter={planning ? [0, 0] : undefined} referenceRegions={planning && planningResult ? planningResult.report.referenceRegions : undefined} /></SceneBoundary>
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
