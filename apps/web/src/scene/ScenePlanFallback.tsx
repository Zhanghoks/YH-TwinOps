import { useId, useMemo } from 'react';
import type { MerchandisingSnapshot, StoreLayout } from '@yh/contracts';
import { useWorkbench } from '../state';
import './ScenePlanFallback.css';

const layoutCenter = (layout: StoreLayout, fixedCenter?: readonly [number, number]) => {
  if (fixedCenter) return fixedCenter;
  const points = layout.zones.flatMap(zone => zone.polygonM ?? []);
  if (!points.length) return [layout.widthM / 2, layout.depthM / 2] as const;
  const xs = points.map(p => p[0]);
  const zs = points.map(p => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2] as const;
};

/** Same layout/selection as the WebGL scene, without creating another canvas. */
export function ScenePlanFallback({ layout, fixedCenter, merchandising }: {
  layout: StoreLayout;
  fixedCenter?: readonly [number, number];
  merchandising?: MerchandisingSnapshot;
}) {
  const id = useId();
  const selection = useWorkbench(s => s.selection);
  const select = useWorkbench(s => s.select);
  const active = selection?.kind === 'fixture' ? layout.fixtures.find(f => f.fixtureId === selection.id) : undefined;
  const zone = layout.zones.find(z => z.zoneId === active?.zoneId);
  const trial = merchandising?.storeId === layout.storeId
    ? merchandising.placements.find(p => p.origin === 'USER_SANDBOX' && p.fixtureId === active?.fixtureId)
    : undefined;
  const [cx, cz] = useMemo(() => layoutCenter(layout, fixedCenter), [layout, fixedCenter]);
  const left = cx - layout.widthM / 2;
  const top = cz - layout.depthM / 2;

  return (
    <div className="yh-plan-fallback" aria-label="二维布局与设施" role="region">
      <div className="yh-plan-header">
        <label htmlFor={id}>查看设施</label>
        <select id={id} value={active?.fixtureId ?? ''} onChange={e => select(e.target.value ? { kind: 'fixture', id: e.target.value } : null)}>
          <option value="">未选中设施</option>
          {layout.fixtures.map(f => <option key={f.fixtureId} value={f.fixtureId}>{f.fixtureId}</option>)}
        </select>
        <span>{layout.widthM} × {layout.depthM} m · 合成布局</span>
      </div>
      <svg className="yh-plan-map" role="img" aria-label="当前门店二维平面示意" viewBox={`${left - 2} ${top - 2} ${layout.widthM + 4} ${layout.depthM + 4}`}>
        <rect x={left} y={top} width={layout.widthM} height={layout.depthM} className="yh-plan-floor" />
        {layout.zones.map(z => z.polygonM && (
          <polygon className="yh-plan-zone" key={z.zoneId} points={z.polygonM.map(([x, depth]) => `${x},${depth}`).join(' ')} />
        ))}
        {layout.fixtures.map(f => (
          <rect key={f.fixtureId} className="yh-plan-fixture" data-selected={active?.fixtureId === f.fixtureId}
            x={-f.widthM / 2} y={-f.depthM / 2} width={f.widthM} height={f.depthM}
            transform={`translate(${f.x} ${f.z}) rotate(${-f.rotationY * 180 / Math.PI})`}
            onClick={() => select({ kind: 'fixture', id: f.fixtureId })}>
            <title>{f.fixtureId}</title>
          </rect>
        ))}
      </svg>
      {active && <div className="yh-plan-selection" aria-live="polite">
        <strong>{active.fixtureId}</strong>{zone && <span>{zone.name}</span>}
        {trial && <span>本机单格试摆：{trial.slotId} · {trial.sku}（不代表库存）</span>}
      </div>}
    </div>
  );
}
