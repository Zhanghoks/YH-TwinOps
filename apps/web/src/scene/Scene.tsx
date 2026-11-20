import type {SameSkuFillRequest} from './sameSkuFill';
import { RetailFixturePreview } from './RetailFixturePreview';
import { RefrigerationFixturePreview } from './RefrigerationFixturePreview';
import { DimensionedShelfPreview } from './DimensionedShelfPreview';
import { StoreCustomers } from './StoreCustomers';
import { DepartmentFloor } from './DepartmentFloor';
import { useCityGroundTexture } from './CityGround';
import { CityTraffic } from './CityTraffic';
import { WeatherScene } from './WeatherScene';
import { WEATHER_PRESETS,type SimulatedWeather } from './weatherModel';
import { buildComponentSample, type ComponentSampleId } from './componentCatalog';
import { buildReferenceCheckoutSigns } from './referenceSignage';
import { REFERENCE_SERVICE_LABELS } from './referenceArchitecture';
import { buildReferenceDisplayFixtures, type ReferenceRegion } from './planningLayout';
/** StoreLayout-driven single-canvas scene; procedural detail never changes business geometry. */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { buildEntranceSiteCamera, buildSceneCamera, fitTopViewHeight, type CameraView } from './sceneCamera';
import { DetailedFixtures, StoreEnvelope } from './DetailedStore';
import * as THREE from 'three';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { isDecisionUsable, METRICS, type Fixture, type StoreLayout, type TwinSnapshot, type ZoneState } from '@yh/contracts';
import { useWorkbench, type ViewLayer } from '../state';

export interface AssetManifest {
  /** assetId → 单设施 GLB URL（仅 approved 资产，白膜模式的换皮来源）。 */
  approved: Map<string, string>;
  /** 整店外壳 GLB URL（role=store-shell 且 approved）；缺省时走白膜模式。 */
  shellUrl?: string;
}

/** One extra demand frame after camera/HTML mounts, without a permanent render loop. */
function SettleView({ revision }: { revision: string }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => invalidate()); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [invalidate, revision]);
  return null;
}

const INITIAL_CAMERA = { fov: 42, near: .5, far: 1000 };

/** Keeping the R3F root alive prevents DOM labels being removed twice on camera changes. */
function SceneCameraRig({ position, target, revision, fitWidth, fitDepth, minDistance, maxDistance }: {
  position: readonly [number, number, number]; target: readonly [number, number, number];
  revision: number; fitWidth?: number; fitDepth?: number; minDistance: number; maxDistance: number;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const [x, initialY, z] = position;
  const [tx, ty, tz] = target;
  // Refit the top map after panel changes without resetting ordinary hand-operated orbit or zoom.
  const y = fitWidth !== undefined && fitDepth !== undefined && size.width > 0 && size.height > 0
    ? fitTopViewHeight(fitWidth, fitDepth, size.width, size.height)
    : initialY;

  useLayoutEffect(() => {
    const orbit = controls.current;
    if (orbit === null) return;
    const damping = orbit.enableDamping;
    orbit.enableDamping = false;
    // Reset pending drag/dolly deltas before jumping to the explicit viewport.
    orbit.reset();
    orbit.target.set(tx, ty, tz);
    camera.position.set(x, y, z);
    orbit.update();
    orbit.enableDamping = damping;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, revision, x, y, z, tx, ty, tz]);

  return <OrbitControls ref={controls} maxPolarAngle={Math.PI / 2.05} minDistance={minDistance} maxDistance={maxDistance} />;
}

/** Mount DOM annotations only after the initial camera and controls have settled. */
function ReadyLabels({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setReady(true)); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, []);
  return ready ? <>{children}</> : null;
}

const WHITE = '#eceff1';
const SELECTED = '#f59e0b';
const GLASS = '#b3cfe0';

/** 图层着色的视觉分档，仅影响底色；告警阈值是另一套口径（见 twin-state defaultAlertRules：队列 ≥8 警告、≥15 严重）。 */
const QUEUE_VISUAL_BANDS = { warn: 5, critical: 12 };

function queueColor(value: number): string {
  if (value >= QUEUE_VISUAL_BANDS.critical) return '#fca5a5';
  if (value >= QUEUE_VISUAL_BANDS.warn) return '#fcd34d';
  return '#bbf7d0';
}

function trafficColor(value: number): string {
  if (value > 100) return '#fca5a5';
  if (value > 40) return '#fcd34d';
  return '#bbf7d0';
}

export type SceneMode = 'detail' | 'shell' | 'white';

interface LayerColors {
  zoneFill: (zone: ZoneState) => string;
  zoneBadge: (zone: ZoneState) => string;
}

function layerColors(layer: ViewLayer): LayerColors {
  if (layer === 'queue') {
    return {
      zoneFill: (z) => {
        const q = z.kpis[METRICS.queueLength];
        return isDecisionUsable(q) ? queueColor(q.value) : '#e2e8f0';
      },
      zoneBadge: (z) => {
        const q = z.kpis[METRICS.queueLength];
        return isDecisionUsable(q) ? `队列 ${q.value} 人` : '无数据';
      },
    };
  }
  if (layer === 'traffic') {
    return {
      zoneFill: (z) => {
        const t = z.kpis[METRICS.trafficCount];
        return isDecisionUsable(t) ? trafficColor(t.value) : '#e2e8f0';
      },
      zoneBadge: (z) => {
        const t = z.kpis[METRICS.trafficCount];
        return isDecisionUsable(t) ? `客流 ${t.value} 人` : t !== undefined && t.stale ? '信号过期' : '无数据';
      },
    };
  }
  if (layer === 'coverage') {
    return {
      zoneFill: (z) => (z.coverage.unknownCount > 0 || z.coverage.staleCount > 0 ? '#fde68a' : '#bbf7d0'),
      zoneBadge: (z) => (z.coverage.unknownCount > 0 || z.coverage.staleCount > 0 ? `缺口 ${z.coverage.unknownCount + z.coverage.staleCount}` : '覆盖正常'),
    };
  }
  return {
    zoneFill: () => '#eef2f6',
    zoneBadge: () => '',
  };
}

/** 按 fixtureType 语义化的白膜组合体（原点底部中心，Y 轴向上）——仅白膜模式使用。 */
function WhiteFixture({ fixture: f, selected }: { fixture: Fixture; selected: boolean }) {
  const color = selected ? SELECTED : WHITE;
  const soft = selected ? SELECTED : '#f8fafc';
  switch (f.fixtureType) {
    case 'GONDOLA':
      return (
        <group>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[f.widthM, 0.1, f.depthM]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {[0.5, 0.95, 1.4].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[f.widthM, 0.06, f.depthM]} />
              <meshStandardMaterial color={soft} />
            </mesh>
          ))}
          <mesh position={[0, f.heightM / 2, -f.depthM / 2 + 0.03]}>
            <boxGeometry args={[f.widthM, f.heightM, 0.06]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      );
    case 'CHECKOUT':
      return (
        <group>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[f.widthM, 0.9, f.depthM]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[-f.widthM * 0.2, 1.0, 0]}>
            <boxGeometry args={[f.widthM * 0.6, 0.2, f.depthM * 0.7]} />
            <meshStandardMaterial color={selected ? SELECTED : '#cbd5e1'} />
          </mesh>
          <mesh position={[f.widthM * 0.32, 1.15, 0]}>
            <boxGeometry args={[0.35, 0.5, 0.4]} />
            <meshStandardMaterial color={selected ? SELECTED : '#94a3b8'} />
          </mesh>
        </group>
      );
    case 'FREEZER':
      return (
        <group>
          <mesh position={[0, f.heightM / 2, -0.05]}>
            <boxGeometry args={[f.widthM, f.heightM, f.depthM]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, f.heightM / 2, f.depthM / 2 + 0.01]}>
            <boxGeometry args={[f.widthM * 0.94, f.heightM * 0.85, 0.02]} />
            <meshStandardMaterial color={GLASS} transparent opacity={0.55} />
          </mesh>
        </group>
      );
    case 'PRODUCE_ISLAND':
      return (
        <group>
          <mesh position={[0, 0.35, 0]}>
            <boxGeometry args={[f.widthM, 0.7, f.depthM]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <boxGeometry args={[f.widthM * 1.05, 0.12, f.depthM * 1.05]} />
            <meshStandardMaterial color={selected ? SELECTED : '#d1e7dd'} />
          </mesh>
        </group>
      );
    case 'DELI_COUNTER':
      return (
        <group>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[f.widthM, 1.0, f.depthM]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 1.2, f.depthM * 0.15]}>
            <boxGeometry args={[f.widthM * 0.96, 0.4, f.depthM * 0.5]} />
            <meshStandardMaterial color={GLASS} transparent opacity={0.5} />
          </mesh>
        </group>
      );
    case 'DOOR':
      return (
        <mesh position={[0, f.heightM / 2, 0]}>
          <boxGeometry args={[f.widthM, f.heightM, Math.max(f.depthM, 0.12)]} />
          <meshStandardMaterial color={selected ? SELECTED : '#cfd8dc'} />
        </mesh>
      );
    default:
      return (
        <mesh position={[0, f.heightM / 2, 0]}>
          <boxGeometry args={[f.widthM, f.heightM, f.depthM]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
  }
}

/** approved GLB：按布局高度统一缩放、底部中心对齐（资产换皮不改业务 ID）。 */
function AssetModel({ url, fixture }: { url: string; fixture?: Fixture }) {
  const gltf = useGLTF(url);
  const model = useMemo(() => {
    const inner = gltf.scene.clone(true);
    if (fixture === undefined) return inner; // 整店外壳：原生尺寸原点，不做缩放
    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? fixture.heightM / size.y : 1;
    inner.scale.setScalar(scale);
    inner.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(inner);
    const center = scaledBox.getCenter(new THREE.Vector3());
    inner.position.set(-center.x, -scaledBox.min.y, -center.z);
    return inner;
  }, [gltf, fixture]);
  return <primitive object={model} />;
}

function FixtureNode({ fixture: f, selected, glbUrl, onSelect }: { fixture: Fixture; selected: boolean; glbUrl?: string; onSelect: (id: string) => void }) {
  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    onSelect(f.fixtureId);
  };
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.rotationY, 0]} onPointerDown={handleClick}>
      {glbUrl === undefined ? (
        <WhiteFixture fixture={f} selected={selected} />
      ) : (
        <Suspense fallback={<WhiteFixture fixture={f} selected={selected} />}>
          <AssetModel url={glbUrl} fixture={f} />
        </Suspense>
      )}
    </group>
  );
}

/**
 * 整店外壳：点击网格按节点名前缀拾取设施（F001__… → fixtureId F001）；
 * 非设施网格（SHELL 地板/墙）不拦截事件，让下层的分区平面/地面接住。
 */
function ShellModel({ url, onSelect }: { url: string; onSelect: (id: string | null) => void }) {
  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    const name = e.object.name ?? '';
    const fixtureId = /^((F\d+))__/.exec(name)?.[1];
    if (fixtureId !== undefined) {
      e.stopPropagation();
      onSelect(fixtureId);
    }
    // 非设施网格不 stopPropagation：事件继续交给分区平面与地面。
  };
  return (
    <Suspense fallback={null}>
      <group onPointerDown={handleClick}>
        <AssetModel url={url} />
      </group>
    </Suspense>
  );
}

function ZoneNode({
  zone,
  name,
  labelVisible,
  planeVisible,
  rect,
  fill,
  badge,
  selected,
  shellMode,
  onSelect,
}: {
  zone: ZoneState;
  name: string;
  labelVisible: boolean;
  planeVisible: boolean;
  rect: readonly [number, number, number, number];
  fill: string;
  badge: string;
  selected: boolean;
  shellMode: boolean;
  onSelect: (id: string) => void;
}) {
  const [x0, z0, x1, z1] = rect;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    onSelect(zone.zoneId);
  };
  // shell 模式：平面是数据叠加层（白膜层除外几乎全透明，选中加亮）；白膜模式：实色分区底色。
  const opacity = shellMode ? (selected ? 0.5 : badge === '' && !selected ? 0.02 : 0.26) : selected ? 0.98 : 0.8;
  return (
    <group>
      <mesh position={[cx, 0.03, cz]} rotation={[-Math.PI / 2, 0, 0]} visible={planeVisible} onPointerDown={planeVisible ? handleClick : undefined}>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
        <meshBasicMaterial color={fill} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <Html position={[cx, shellMode ? 2.6 : 0.6, cz]} center zIndexRange={[10, 0]} style={{visibility:labelVisible ? 'visible' : 'hidden'}}>
        <div className={`zone-label${selected ? ' is-selected' : ''}`} style={{ pointerEvents: 'none' }}>
          <strong>{name.split(' / ')[0]}</strong>
          {badge !== '' && <span>{badge}</span>}
        </div>
      </Html>
    </group>
  );
}

export function Scene({ snapshot, layout, manifest, mode = 'detail', cameraView = 'overview', cameraRevision = 0, showLabels = true, fixedCenter, referenceRegions, componentId, weather = 'sunny', reducedMotion = false, cityPaused = false, cloudQuality = 'low', economy = true, showCustomers = true, customersPaused = false, operatingOccupancy, operatingOccupancyLabel = '平均在场估算', active = true, stocked = true, f032Trial = false, pilotTrials = [], fillRequest }: { snapshot: TwinSnapshot; layout: StoreLayout; manifest: AssetManifest; mode?: SceneMode; cameraView?: CameraView; cameraRevision?: number; showLabels?: boolean; fixedCenter?: readonly [number, number]; referenceRegions?: ReferenceRegion[]; componentId?: ComponentSampleId; weather?: SimulatedWeather; reducedMotion?: boolean; cityPaused?: boolean; cloudQuality?: 'off'|'low'|'high'; economy?: boolean; showCustomers?: boolean; customersPaused?: boolean; operatingOccupancy?: Record<string,number>; operatingOccupancyLabel?: string; active?: boolean; stocked?: boolean; f032Trial?: boolean; pilotTrials?: readonly string[]; fillRequest?:SameSkuFillRequest }) {
  const layer = useWorkbench((s) => s.layer);
  const selection = useWorkbench((s) => s.selection);
  const select = useWorkbench((s) => s.select);
  const colors = layerColors(layer);
  const shellMode = mode === 'shell' && manifest.shellUrl !== undefined;
  const detailed = mode === 'detail';
  // These image-inferred shelves are visual skins only; never enter snapshot or selection.
  const checkoutSigns = useMemo(() => referenceRegions ? buildReferenceCheckoutSigns(layout.fixtures) : [], [layout, referenceRegions]);
  const referenceDisplays = useMemo(() => referenceRegions ? buildReferenceDisplayFixtures(layout) : [], [layout, referenceRegions]);
  const zoneById = useMemo(() => Object.fromEntries(Object.values(snapshot.zones).map((z) => [z.zoneId, z])), [snapshot]);

  const zoneRects = useMemo(
    () =>
      new Map(
        layout.zones.map((z) => {
          const poly = z.polygonM ?? [];
          const xs = poly.map((p) => p[0]);
          const zs = poly.map((p) => p[1]);
          return [z.zoneId, [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] as const];
        }),
      ),
    [layout],
  );

  // 布局坐标为居中原点（老概念店坐标系）或角点坐标系（生成布局）：地面中心随之取齐。
  const groundCenter = useMemo(() => {
    if (fixedCenter) return fixedCenter;
    const rects = [...zoneRects.values()];
    if (rects.length === 0) return [layout.widthM / 2, layout.depthM / 2] as const;
    const xs = rects.flatMap((r) => [r[0], r[2]]);
    const zs = rects.flatMap((r) => [r[1], r[3]]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2] as const;
  }, [zoneRects, layout, fixedCenter]);

  const [cityMetrics,setCityMetrics]=useState('采样中');
  const cityGround = useCityGroundTexture(layout.widthM,layout.depthM);
  const distantGround = useCityGroundTexture(layout.widthM,layout.depthM,true);
  const sample = useMemo(() => componentId ? buildComponentSample(componentId) : undefined, [componentId]);
  const lighting=WEATHER_PRESETS[sample ? 'sunny' : weather];
  const sampleSpan = sample ? Math.max(sample.widthM, sample.depthM, sample.heightM) : 1;
  const camera = sample ? { position: [sampleSpan*1.65, sampleSpan*1.15, sampleSpan*1.65] as [number, number, number], target: [0, sample.heightM*.45, 0] as [number, number, number] } : referenceRegions && cameraView === 'entrance' ? buildEntranceSiteCamera(groundCenter,layout.depthM,-22.5) : buildSceneCamera(cameraView, groundCenter, layout.depthM, layout.widthM);
  const fitTop = !sample && !!referenceRegions && cameraView === 'top';
  const drawReferenceLabels = !sample && showLabels && !!referenceRegions && layer === 'none';
  const referenceLabelStyle = { visibility: drawReferenceLabels ? 'visible' : 'hidden' } as const;
  return (
    <><Canvas className="scene-canvas" shadows={!economy} frameloop={active ? "demand" : "never"} camera={INITIAL_CAMERA} dpr={economy ? .85 : [1, 1.5]}>
      <SettleView revision={`${cameraView}-${cameraRevision}-${showLabels}-${!!referenceRegions}`} />
      <color attach="background" args={['#e8eceb']} />
      {!sample&&<fog attach="fog" args={[lighting.horizon,cameraView==='site'?500:350,900]}/>}
      {!sample && <WeatherScene cloudQuality={cloudQuality} weather={weather} width={layout.widthM} depth={layout.depthM} center={groundCenter} reducedMotion={reducedMotion} />}
      {!sample && <CityTraffic width={layout.widthM} depth={layout.depthM} center={groundCenter} paused={cityPaused} onMetrics={setCityMetrics} />}
      {/* shell 模型自带较暗的烘焙色调，光照对齐老原型的强度口径 */}
      <hemisphereLight args={[shellMode ? '#e5fff0' : '#fff3d9', shellMode ? '#34413e' : '#56615c', shellMode ? 2.1 : lighting.ambient]} />
      <directionalLight position={[20, 60, 35]} intensity={shellMode ? 2.1 : lighting.sun} color={lighting.sunColor} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={referenceRegions ? -75 : -60} shadow-camera-right={referenceRegions ? 75 : 60} shadow-camera-top={referenceRegions ? 75 : 60} shadow-camera-bottom={referenceRegions ? -75 : -60} shadow-camera-far={150} shadow-normalBias={0.05} shadow-bias={-0.0002} />
      <SceneCameraRig position={camera.position} target={camera.target} revision={cameraRevision} fitWidth={fitTop ? layout.widthM : undefined} fitDepth={fitTop ? layout.depthM : undefined} minDistance={sample ? 1 : 5} maxDistance={Math.max(220, layout.depthM * 4)} />

      {sample && <>
        {componentId === 'retail-produce' || componentId === 'retail-service' || componentId === 'retail-checkout' ? <RetailFixturePreview kind={componentId === 'retail-produce' ? 'produce' : componentId === 'retail-service' ? 'service' : 'checkout'} /> : componentId === 'refrigeration-island' || componentId === 'refrigeration-upright' || componentId === 'refrigeration-open' ? <RefrigerationFixturePreview kind={componentId === 'refrigeration-island' ? 'island' : componentId === 'refrigeration-upright' ? 'upright' : 'open'} /> : componentId === 'dimensioned-wall' || componentId === 'dimensioned-gondola' ? <DimensionedShelfPreview kind={componentId === 'dimensioned-wall' ? 'wall' : 'gondola'} /> : <DetailedFixtures stocked={stocked} fixtures={[]} decorations={[sample]} onSelect={() => {}} />}
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]} receiveShadow><planeGeometry args={[12,12]}/><meshStandardMaterial color="#e5e1d8" /></mesh>
      </>}
      {!sample && <>
      {/* 地面（白膜模式）与取消选择热区 */}
      <mesh position={[groundCenter[0],-.4,groundCenter[1]]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[layout.widthM+900,layout.depthM+900]}/><meshLambertMaterial map={distantGround}/></mesh>
      <mesh position={[groundCenter[0], detailed ? -0.25 : -0.01, groundCenter[1]]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={() => select(null)}>
        <planeGeometry args={[layout.widthM + 260, layout.depthM + 300]} />
        <meshStandardMaterial map={cityGround} color={shellMode ? '#cfd6dd' : '#ffffff'} />
      </mesh>
      {!shellMode && !detailed && (
        <gridHelper args={[layout.widthM, layout.widthM / 2, '#c4ccd4', '#d8dee4']} position={[groundCenter[0], 0.005, groundCenter[1]]} />
      )}

      {shellMode && <ShellModel url={manifest.shellUrl as string} onSelect={(id) => (id === null ? select(null) : select({ kind: 'fixture', id }))} />}

      {detailed && <>
        {referenceRegions&&<DepartmentFloor regions={referenceRegions}/>}
        <StoreEnvelope layout={layout} center={groundCenter} reference={!!referenceRegions} />
        {showCustomers && <StoreCustomers layout={layout} decorations={referenceDisplays} paused={customersPaused} />}
        <DetailedFixtures fillRequest={fillRequest} pilotTrials={pilotTrials} f032Trial={f032Trial} stocked={stocked} compactFaces={economy} fixtures={layout.fixtures} decorations={referenceDisplays} selectedId={selection?.kind === 'fixture' ? selection.id : undefined} onSelect={(id) => select({ kind: 'fixture', id })} />
      </>}
      </>}

      {/* Visibility toggles must not destroy subordinate React roots owned by Html. */}
      <ReadyLabels>
      {referenceRegions && checkoutSigns.map((sign) => <Html wrapperClass="reference-html-anchor" style={referenceLabelStyle} key={`sign-${sign.fixtureId}`} position={sign.position} center zIndexRange={[8,0]}><span className="reference-checkout-number" aria-label={`图示收银通道 ${sign.text}，非业务编号`}>{sign.text}</span></Html>)}
      {referenceRegions && referenceRegions.filter((region) => region.code !== 'BACK').map((region) => <Html wrapperClass="reference-html-anchor" style={referenceLabelStyle} key={region.code} position={[(region.bounds.x0 + region.bounds.x1) / 2, 3, (region.bounds.z0 + region.bounds.z1) / 2]} center zIndexRange={[10, 0]}>
        <div className="zone-label reference-label"><strong>{region.label}</strong><span>{region.code === 'BACK' ? '参考图后勤带' : region.code} · 图面分区</span></div>
      </Html>)}

      {referenceRegions && REFERENCE_SERVICE_LABELS.filter((item) => item.id !== 'service' && item.id !== 'entry').map((item) => <Html wrapperClass="reference-html-anchor" style={referenceLabelStyle} key={item.id} position={[...item.position]} center zIndexRange={[10, 0]}><div className="zone-label reference-label"><strong>{item.id === 'chilled' ? '冷藏' : item.id === 'frozen' ? '冷冻' : item.text}</strong><span>图面推定</span></div></Html>)}

      </ReadyLabels>

      {/* 分区数据叠加层与标签 */}
      {layout.zones.map((z) => {
        const state = zoneById[z.zoneId];
        const rect = zoneRects.get(z.zoneId);
        if (state === undefined || rect === undefined) return null;
        return (
          <ZoneNode
            key={z.zoneId}
            zone={state}
            name={z.name}
            labelVisible={!sample && showLabels && (!referenceRegions || layer !== 'none')}
            planeVisible={!sample}
            rect={rect}
            fill={layer === 'traffic' && operatingOccupancy ? trafficColor(operatingOccupancy[z.zoneId] ?? 0) : colors.zoneFill(state)}
            badge={layer === 'traffic' && operatingOccupancy ? `${operatingOccupancyLabel} ${operatingOccupancy[z.zoneId] ?? 0} 人（合成）` : colors.zoneBadge(state)}
            selected={selection?.kind === 'zone' && selection.id === z.zoneId}
            shellMode={shellMode || detailed}
            onSelect={(id) => select({ kind: 'zone', id })}
          />
        );
      })}

      {/* 白膜模式的设施渲染（shell 模式下设施视觉来自外壳模型，点击拾取走节点名） */}
      {!sample && !shellMode && !detailed &&
        layout.fixtures.map((f) => (
          <FixtureNode
            key={f.fixtureId}
            fixture={f}
            selected={selection?.kind === 'fixture' && selection.id === f.fixtureId}
            glbUrl={manifest.approved.get(f.assetId)}
            onSelect={(id) => select({ kind: 'fixture', id })}
          />
        ))}
    </Canvas>
    {!sample&&<div style={{position:"absolute",pointerEvents:"none",zIndex:22,right:16,top:170,background:"#fffdf1e8",padding:"4px 8px",fontSize:11,color:"#40534c"}}>城市模拟 · {cityPaused?"已静止":cityMetrics}（当前视角实测，非 GPU 耗时）</div>}</>
  );
}
