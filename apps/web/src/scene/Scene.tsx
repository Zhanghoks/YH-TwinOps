/** StoreLayout-driven single-canvas scene; procedural detail never changes business geometry. */
import { Suspense, useMemo } from 'react';
import { DetailedFixtures, StoreEnvelope } from './DetailedStore';
import * as THREE from 'three';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { isDecisionUsable, METRICS, type Fixture, type StoreLayout, type TwinSnapshot, type ZoneState } from '@yh/contracts';
import { useWorkbench, type ViewLayer } from '../state';

export interface AssetManifest {
  /** assetId → 单设施 GLB URL（仅 approved 资产，白膜模式的换皮来源）。 */
  approved: Map<string, string>;
  /** 整店外壳 GLB URL（role=store-shell 且 approved）；缺省时走白膜模式。 */
  shellUrl?: string;
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
  rect,
  fill,
  badge,
  selected,
  shellMode,
  onSelect,
}: {
  zone: ZoneState;
  name: string;
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
      <mesh position={[cx, 0.03, cz]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={handleClick}>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
        <meshBasicMaterial color={fill} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {name !== '' && <Html position={[cx, shellMode ? 2.6 : 0.6, cz]} center distanceFactor={55} zIndexRange={[10, 0]}>
        <div className="zone-label" style={{ pointerEvents: 'none' }}>
          <strong>{name.split(' / ')[0]}</strong><small>{zone.zoneId.replace('zone-', '')}</small>
          {badge !== '' && <span>{badge}</span>}
        </div>
      </Html>}
    </group>
  );
}

export function Scene({ snapshot, layout, manifest, mode = 'detail', cameraView = 'overview', cameraRevision = 0, showLabels = true }: { snapshot: TwinSnapshot; layout: StoreLayout; manifest: AssetManifest; mode?: SceneMode; cameraView?: 'overview' | 'top'; cameraRevision?: number; showLabels?: boolean }) {
  const layer = useWorkbench((s) => s.layer);
  const selection = useWorkbench((s) => s.selection);
  const select = useWorkbench((s) => s.select);
  const colors = layerColors(layer);
  const shellMode = mode === 'shell' && manifest.shellUrl !== undefined;
  const detailed = mode === 'detail';
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
    const rects = [...zoneRects.values()];
    if (rects.length === 0) return [layout.widthM / 2, layout.depthM / 2] as const;
    const xs = rects.flatMap((r) => [r[0], r[2]]);
    const zs = rects.flatMap((r) => [r[1], r[3]]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2] as const;
  }, [zoneRects, layout]);

  return (
    <Canvas key={`${cameraView}-${cameraRevision}`} shadows frameloop="demand" camera={{ position: cameraView === 'top' ? [groundCenter[0], 115, groundCenter[1] + 0.1] : [groundCenter[0] + 48, 64, groundCenter[1] + 78], fov: 42 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#e8eceb']} />
      {/* shell 模型自带较暗的烘焙色调，光照对齐老原型的强度口径 */}
      <hemisphereLight args={['#e5fff0', '#34413e', shellMode ? 2.1 : 1.5]} />
      <directionalLight position={[20, 60, 35]} intensity={shellMode ? 2.1 : 2.2} color="#fff3de" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} shadow-camera-far={150} shadow-normalBias={0.05} />
      <OrbitControls target={[groundCenter[0], 0, groundCenter[1]]} maxPolarAngle={Math.PI / 2.05} minDistance={5} maxDistance={220} />

      {/* 地面（白膜模式）与取消选择热区 */}
      <mesh position={[groundCenter[0], detailed ? -0.04 : -0.01, groundCenter[1]]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={() => select(null)}>
        <planeGeometry args={[layout.widthM + 40, layout.depthM + 40]} />
        <meshStandardMaterial color={shellMode ? '#cfd6dd' : '#dee3e9'} />
      </mesh>
      {!shellMode && !detailed && (
        <gridHelper args={[layout.widthM, layout.widthM / 2, '#c4ccd4', '#d8dee4']} position={[groundCenter[0], 0.005, groundCenter[1]]} />
      )}

      {shellMode && <ShellModel url={manifest.shellUrl as string} onSelect={(id) => (id === null ? select(null) : select({ kind: 'fixture', id }))} />}

      {detailed && <>
        <StoreEnvelope layout={layout} center={groundCenter} />
        <DetailedFixtures fixtures={layout.fixtures} selectedId={selection?.kind === 'fixture' ? selection.id : undefined} onSelect={(id) => select({ kind: 'fixture', id })} />
      </>}

      {/* 分区数据叠加层与标签 */}
      {layout.zones.map((z) => {
        const state = zoneById[z.zoneId];
        const rect = zoneRects.get(z.zoneId);
        if (state === undefined || rect === undefined) return null;
        return (
          <ZoneNode
            key={z.zoneId}
            zone={state}
            name={showLabels ? z.name : ''}
            rect={rect}
            fill={colors.zoneFill(state)}
            badge={colors.zoneBadge(state)}
            selected={selection?.kind === 'zone' && selection.id === z.zoneId}
            shellMode={shellMode || detailed}
            onSelect={(id) => select({ kind: 'zone', id })}
          />
        );
      })}

      {/* 白膜模式的设施渲染（shell 模式下设施视觉来自外壳模型，点击拾取走节点名） */}
      {!shellMode && !detailed &&
        layout.fixtures.map((f) => (
          <FixtureNode
            key={f.fixtureId}
            fixture={f}
            selected={selection?.kind === 'fixture' && selection.id === f.fixtureId}
            glbUrl={manifest.approved.get(f.assetId)}
            onSelect={(id) => select({ kind: 'fixture', id })}
          />
        ))}

      <Html position={[groundCenter[0] - layout.widthM / 2 + 8, 1, groundCenter[1] + layout.depthM / 2 + 9]} center zIndexRange={[10, 0]}>
        <div className="store-caption" style={{ pointerEvents: 'none' }}>
          合成教学压测布局 {layout.widthM}×{layout.depthM} m（非真实门店测量）
        </div>
      </Html>
    </Canvas>
  );
}
