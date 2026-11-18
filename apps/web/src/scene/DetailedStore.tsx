/** Original procedural teaching assets: geometry is a skin, StoreLayout remains authoritative. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Fixture, StoreLayout } from '@yh/contracts';
import { buildFixtureDetail, type DetailPart, type DetailFixtureShape } from './detailGeometry';
import { buildStoreArchitecture, type ArchitecturePart } from './storeArchitecture';
import { buildReferenceArchitecture } from './referenceArchitecture';
import { buildSurfacePixels, type SurfaceKind } from './materialSurface';

interface Instance { part: DetailPart; fixture: DetailFixtureShape; selectable: boolean }
const MATERIALS = ['metal', 'wood', 'glass', 'product', 'label', 'rubber', 'produceBed'] as const;


/** Shared per batch, not per item; no extra meshes, materials or draw calls. */
function useSurfaceMaps(kind: SurfaceKind | undefined, repeatX = 1, repeatY = 1) {
  const maps = useMemo(() => {
    if (kind === undefined) return undefined;
    const pixels = buildSurfacePixels(kind);
    const make = (bytes: Uint8Array, srgb: boolean): THREE.DataTexture => {
      const texture = new THREE.DataTexture(bytes, pixels.width, pixels.height, THREE.RGBAFormat);
      texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      return texture;
    };
    return { color: make(pixels.color, true), roughness: make(pixels.roughness, false), bump: make(pixels.heightMap, false) };
  }, [kind, repeatX, repeatY]);
  useEffect(() => {
    if (maps === undefined) return;
    // Effect replay can reuse the CPU arrays after a renderer has released its GPU copies.
    for (const texture of Object.values(maps)) texture.needsUpdate = true;
    return () => { for (const texture of Object.values(maps)) texture.dispose(); };
  }, [maps]);
  return maps;
}

function Batch({ instances, primitive, material, onSelect }: {
  instances: Instance[];
  primitive: DetailPart['primitive'];
  material: DetailPart['material'];
  onSelect: (id: string) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const surfaceKind: SurfaceKind | undefined = material === 'produceBed' ? 'produceBed' : material === 'wood' ? 'wood' : material === 'metal' ? 'brushedMetal' : material === 'product' ? (primitive === 'sphere' ? 'produce' : 'packaging') : undefined;
  const surface = useSurfaceMaps(surfaceKind);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (mesh === null) return;
    const transform = new THREE.Object3D();
    const local = new THREE.Vector3();
    const color = new THREE.Color();
    instances.forEach(({ part, fixture: f }, index) => {
      local.set(...part.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), f.rotationY);
      transform.position.set(f.x + local.x, f.y + local.y, f.z + local.z);
      transform.rotation.set(0, f.rotationY, 0);
      transform.scale.set(...part.size);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, color.set(part.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances]);
  const click = (event: ThreeEvent<MouseEvent>): void => {
    const instance = event.instanceId === undefined ? undefined : instances[event.instanceId];
    if (instance === undefined) return;
    event.stopPropagation();
    if (!instance.selectable) return;
    onSelect(instance.fixture.fixtureId);
  };
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, instances.length]} castShadow={material !== 'glass'} receiveShadow onPointerDown={click}>
      {primitive === 'box' ? <boxGeometry args={[1, 1, 1]} /> : <sphereGeometry args={[0.5, 8, 6]} />}
      <meshStandardMaterial
        map={surface?.color ?? null}
        roughnessMap={surface?.roughness ?? null}
        bumpMap={surface?.bump ?? null}
        bumpScale={material === 'produceBed' ? .045 : material === 'wood' ? .012 : material === 'metal' ? .002 : .003}
        roughness={surface ? 1 : material === 'glass' ? .18 : .78}
        metalness={material === 'metal' ? .48 : 0}
        transparent={material === 'glass'} opacity={material === 'glass' ? 0.25 : 1}
        depthWrite={material !== 'glass'}
      />
    </instancedMesh>
  );
}

export function DetailedFixtures({ fixtures, decorations = [], selectedId, onSelect }: {
  fixtures: Fixture[]; decorations?: DetailFixtureShape[]; selectedId?: string; onSelect: (id: string) => void;
}) {
  const batches = useMemo(() => {
    const all = [...fixtures.flatMap((fixture) => buildFixtureDetail(fixture).map((part) => ({ fixture, part, selectable: true }))), ...decorations.flatMap((fixture) => buildFixtureDetail(fixture).map((part) => ({ fixture, part, selectable: false })))];
    return MATERIALS.flatMap((material) => (['box', 'sphere'] as const).map((primitive) => ({
      material, primitive, instances: all.filter(({ part }) => part.material === material && part.primitive === primitive),
    }))).filter(({ instances }) => instances.length > 0);
  }, [fixtures, decorations]);
  const selected = fixtures.find((f) => f.fixtureId === selectedId);
  return <group>
    {batches.map((batch) => <Batch key={`${batch.material}-${batch.primitive}`} {...batch} onSelect={onSelect} />)}
    {selected !== undefined && <group position={[selected.x, selected.y + selected.heightM / 2, selected.z]} rotation={[0, selected.rotationY, 0]}>
      <mesh>
        <boxGeometry args={[selected.widthM + 0.06, selected.heightM + 0.06, selected.depthM + 0.06]} />
        <meshBasicMaterial color="#f59e0b" wireframe />
      </mesh>
    </group>}
  </group>;
}

function ArchitectureBatch({ parts, primitive, transparent, emissive }: { parts: ArchitecturePart[]; primitive: 'box' | 'sphere'; transparent: boolean; emissive: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    parts.forEach((part, i) => {
      transform.position.set(...part.position);
      transform.scale.set(...part.size);
      transform.updateMatrix();
      ref.current?.setMatrixAt(i, transform.matrix);
      ref.current?.setColorAt(i, color.set(part.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} castShadow={!transparent && !emissive} receiveShadow={!emissive}>
    {primitive === 'sphere' ? <sphereGeometry args={[.5, 10, 8]} /> : <boxGeometry args={[1, 1, 1]} />}
    <meshStandardMaterial roughness={transparent ? .15 : .65} metalness={transparent ? .1 : .12} transparent={transparent} opacity={transparent ? .22 : 1} depthWrite={!transparent} emissive={emissive ? '#ffdca0' : '#000000'} emissiveIntensity={emissive ? .7 : 0} />
  </instancedMesh>;
}

/** Perimeter-only architectural context, never added to business collision geometry. */
export function StoreEnvelope({ layout, center, reference = false }: { layout: StoreLayout; center: readonly [number, number]; reference?: boolean }) {
  const w = layout.widthM;
  const d = layout.depthM;
  const floorSurface = useSurfaceMaps(reference ? 'floorTile' : undefined, w / 2, d / 2);
  const signTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#b82d38'; ctx.fillRect(0, 0, 1024, 128);
      ctx.fillStyle = '#fff8ed'; ctx.font = '600 64px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('YH · 合成教学门店', 512, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => signTexture.dispose(), [signTexture]);
  const batches = useMemo(() => {
    const shell = buildStoreArchitecture(w, d, reference ? { entranceCenterX: -22.5, entranceWidthM: 23, neutralFacade: true } : {});
    const parts = reference ? [...shell.filter((p) => !p.id.startsWith('entrance-cart-rack')), ...buildReferenceArchitecture(layout.fixtures)] : shell;
    return (['box', 'sphere'] as const).flatMap((primitive) => [false, true].flatMap((transparent) => [false, true].map((emissive) => ({
      primitive, transparent, emissive,
      parts: parts.filter((p) => p.primitive === primitive && !!p.transparent === transparent && !!p.emissive === emissive),
    })))).filter((batch) => batch.parts.length > 0);
  }, [w, d, reference, layout.fixtures]);
  return <group position={[center[0], 0, center[1]]}>
    <mesh position={[0, -.13, 0]} receiveShadow>
      <boxGeometry args={[w + .6, .24, d + .6]} /><meshStandardMaterial color={reference ? '#ecebe5' : '#e8e2d3'} roughness={.72} />
    </mesh>
    {reference && <mesh position={[0, -.008, 0]} rotation={[-Math.PI / 2,0,0]} receiveShadow>
      <planeGeometry args={[w,d]} /><meshStandardMaterial color="#f1f0e9" map={floorSurface?.color} roughnessMap={floorSurface?.roughness} bumpMap={floorSurface?.bump} roughness={1} bumpScale={.004} />
    </mesh>}
    {!reference && <>
    {Array.from({ length: Math.floor(w / 2) + 1 }, (_, i) => <mesh key={`x-${i}`} position={[-w / 2 + i * 2, .002, 0]}>
      <boxGeometry args={[.024, .005, d]} /><meshBasicMaterial color="#ded8cb" />
    </mesh>)}
    {Array.from({ length: Math.floor(d / 2) + 1 }, (_, i) => <mesh key={`z-${i}`} position={[0, .002, -d / 2 + i * 2]}>
      <boxGeometry args={[w, .005, .024]} /><meshBasicMaterial color="#ded8cb" />
    </mesh>)}
    </>}
    <mesh position={[0, 1.8, -d / 2 - .45]} receiveShadow>
      <boxGeometry args={[w + .5, 3.6, .28]} /><meshStandardMaterial color="#e0d8c8" roughness={.8} />
    </mesh>
    {!reference && <mesh position={[0, 2.9, d / 2 + .39]}>
      <planeGeometry args={[Math.min(w * .45, 18), .82]} /><meshBasicMaterial map={signTexture} toneMapped={false} />
    </mesh>}
    {batches.map((batch) => <ArchitectureBatch key={`${batch.primitive}-${batch.transparent}-${batch.emissive}`} {...batch} />)}
  </group>;
}
