import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Box, RotateCcw, RotateCw } from 'lucide-react';
import { AmbientLight, DirectionalLight, Group, OrthographicCamera, Scene } from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import type { ProductCatalogItem } from '../catalog/productCatalog';
import { disposeDetailedProduct, makeDetailedProduct } from '../scene/detailedProductThree';
import { BeautifulButton } from './beautiful/Button';
import './ProductModelPreview.css';

const INITIAL_VIEW = { yaw: -.48, pitch: .16 };
const AXIS_LIMIT = .9;
const clampPitch = (value: number) => Math.min(AXIS_LIMIT, Math.max(-AXIS_LIMIT, value));

/**
 * Reuse the store's product meshes. Project them as SVG instead of mounting a
 * second WebGL canvas, so the 3D workspace retains its one live renderer.
 */
export function ProductModelPreview({ product }: { product: ProductCatalogItem }) {
  const { modelKey, color, referenceSizeMm: [width, height, depth] } = product;
  const [view, setView] = useState(INITIAL_VIEW);
  const [unavailable, setUnavailable] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const project = useRef<((yaw: number, pitch: number) => void) | null>(null);
  const dragging = (value: PointerEvent<HTMLDivElement>) => value.pointerId === drag.current?.id;

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    let productMesh: ReturnType<typeof makeDetailedProduct> | undefined;
    let node: SVGElement | undefined;
    try {
      const normalized = Math.max(width, height, depth);
      productMesh = makeDetailedProduct({
        kind: modelKey, size: [width / normalized, height / normalized, depth / normalized], color,
      });
      productMesh.position.y = -(height / normalized) / 2;
      const rotation = new Group();
      rotation.rotation.order = 'XYZ';
      rotation.add(productMesh);
      const scene = new Scene();
      const key = new DirectionalLight('#fff8ed', 1);
      key.position.set(-2, 4, 4);
      const fill = new DirectionalLight('#e5f2fa', .34);
      fill.position.set(1, 2, -3);
      scene.add(rotation, new AmbientLight('#f6faf8', .68), key, fill);
      const camera = new OrthographicCamera(-.92, .92, .69, -.69, .01, 10);
      camera.position.set(0, 0, 3);
      camera.lookAt(0, 0, 0);
      const renderer = new SVGRenderer();
      renderer.setSize(400, 300);
      renderer.setPrecision(2);
      renderer.overdraw = .18;
      node = renderer.domElement;
      node.setAttribute('aria-hidden', 'true');
      node.style.removeProperty('background-color');
      mount.append(node);
      const draw = (yaw: number, pitch: number) => {
        rotation.rotation.set(pitch, yaw, 0);
        renderer.render(scene, camera);
        node?.style.removeProperty('background-color');
      };
      project.current = draw;
      draw(INITIAL_VIEW.yaw, INITIAL_VIEW.pitch);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
    return () => {
      project.current = null;
      node?.remove();
      if (productMesh) disposeDetailedProduct(productMesh);
    };
  }, [modelKey, color, width, height, depth]);

  useEffect(() => { project.current?.(view.yaw, view.pitch); }, [view, modelKey, color, width, height, depth]);

  function orbit(deltaYaw: number, deltaPitch = 0) {
    setView(prev => ({
      yaw: (prev.yaw + deltaYaw) % (2 * Math.PI), pitch: clampPitch(prev.pitch + deltaPitch),
    }));
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Home') { event.preventDefault(); setView(INITIAL_VIEW); return; }
    const delta: readonly [number, number] | undefined = event.key === 'ArrowLeft' ? [-.18, 0] : event.key === 'ArrowRight' ? [.18, 0]
      : event.key === 'ArrowUp' ? [0, .12] : event.key === 'ArrowDown' ? [0, -.12] : undefined;
    if (!delta) return;
    event.preventDefault();
    orbit(delta[0], delta[1]);
  }

  return <figure className="pc-model" aria-label={`${product.name}的 3D 示意模型`}>
    <div className="pc-model-head"><span><Box aria-hidden="true" size={14}/> 商品模型</span><span className="pc-model-mode">3D 示意</span></div>
    <div
      className="pc-model-stage"
      role="group"
      aria-label="模型视角，方向键旋转，Home 键复位"
      tabIndex={0}
      onKeyDown={handleKeys}
      onPointerDown={event => {
        if (event.button !== 0 || drag.current !== null || unavailable) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={event => {
        const pointer = drag.current;
        if (!pointer || !dragging(event)) return;
        orbit((event.clientX - pointer.x) * .016, (event.clientY - pointer.y) * .012);
        drag.current = { id: pointer.id, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={event => { if (dragging(event)) drag.current = null; }}
      onPointerCancel={event => { if (dragging(event)) drag.current = null; }}
      onLostPointerCapture={event => { if (dragging(event)) drag.current = null; }}
    >
      <div className="pc-model-surface" ref={host}/>
      {unavailable && <p role="status">模型暂时无法预览，请查看右侧参数。</p>}
    </div>
    <figcaption className="pc-model-footer">
      <span>拖动旋转 · 示意比例</span>
      <div role="group" aria-label="视角控制">
        <BeautifulButton size="xs" variant="quiet" aria-label="向左旋转模型" title="向左旋转" disabled={unavailable} onClick={() => orbit(-.35)}><RotateCcw size={14} aria-hidden="true"/></BeautifulButton>
        <BeautifulButton size="xs" variant="quiet" aria-label="向右旋转模型" title="向右旋转" disabled={unavailable} onClick={() => orbit(.35)}><RotateCw size={14} aria-hidden="true"/></BeautifulButton>
        <BeautifulButton size="xs" variant="quiet" disabled={unavailable} onClick={() => setView(INITIAL_VIEW)}>复位</BeautifulButton>
      </div>
    </figcaption>
  </figure>;
}
