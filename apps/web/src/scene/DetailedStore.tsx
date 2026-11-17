/** Original procedural teaching assets: geometry is a skin, StoreLayout remains authoritative. */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Fixture, StoreLayout } from '@yh/contracts';
import { buildFixtureDetail, type DetailPart } from './detailGeometry';

interface Instance { part: DetailPart; fixture: Fixture }
const MATERIALS = ['metal', 'wood', 'glass', 'product', 'label', 'rubber'] as const;

function Batch({ instances, primitive, material, onSelect }: {
  instances: Instance[];
  primitive: DetailPart['primitive'];
  material: DetailPart['material'];
  onSelect: (id: string) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
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
    onSelect(instance.fixture.fixtureId);
  };
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, instances.length]} castShadow={material !== 'glass'} receiveShadow onPointerDown={click}>
      {primitive === 'box' ? <boxGeometry args={[1, 1, 1]} /> : <sphereGeometry args={[0.5, 8, 6]} />}
      <meshStandardMaterial
        roughness={material === 'metal' ? 0.4 : material === 'glass' ? 0.18 : 0.78}
        metalness={material === 'metal' ? 0.35 : 0}
        transparent={material === 'glass'} opacity={material === 'glass' ? 0.25 : 1}
        depthWrite={material !== 'glass'}
      />
    </instancedMesh>
  );
}

export function DetailedFixtures({ fixtures, selectedId, onSelect }: {
  fixtures: Fixture[]; selectedId?: string; onSelect: (id: string) => void;
}) {
  const batches = useMemo(() => {
    const all = fixtures.flatMap((fixture) => buildFixtureDetail(fixture).map((part) => ({ fixture, part })));
    return MATERIALS.flatMap((material) => (['box', 'sphere'] as const).map((primitive) => ({
      material, primitive, instances: all.filter(({ part }) => part.material === material && part.primitive === primitive),
    }))).filter(({ instances }) => instances.length > 0);
  }, [fixtures]);
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

/** Cutaway envelope: no roof or invented columns hiding operational information. */
export function StoreEnvelope({ layout, center }: { layout: StoreLayout; center: readonly [number, number] }) {
  const w = layout.widthM;
  const d = layout.depthM;
  return <group position={[center[0], 0, center[1]]}>
    <mesh position={[0, -0.13, 0]} receiveShadow>
      <boxGeometry args={[w + 0.6, 0.24, d + 0.6]} /><meshStandardMaterial color="#e7e4da" roughness={0.9} />
    </mesh>
    {/* Tile joints: restrained scale cues without texture downloads. */}
    {Array.from({ length: Math.floor(w / 2) + 1 }, (_, i) => <mesh key={`x-${i}`} position={[-w / 2 + i * 2, 0.002, 0]}>
      <boxGeometry args={[0.012, 0.005, d]} /><meshStandardMaterial color="#cecbbf" />
    </mesh>)}
    {Array.from({ length: Math.floor(d / 2) + 1 }, (_, i) => <mesh key={`z-${i}`} position={[0, 0.002, -d / 2 + i * 2]}>
      <boxGeometry args={[w, 0.005, 0.012]} /><meshStandardMaterial color="#cecbbf" />
    </mesh>)}
    <mesh position={[0, 1.8, -d / 2 - 0.16]} castShadow receiveShadow>
      <boxGeometry args={[w + 0.6, 3.6, 0.3]} /><meshStandardMaterial color="#d7d4c9" />
    </mesh>
    <mesh position={[-w / 2 - 0.16, 0.65, 0]} receiveShadow>
      <boxGeometry args={[0.3, 1.3, d]} /><meshStandardMaterial color="#d7d4c9" />
    </mesh>
    <mesh position={[w / 2 + 0.16, 0.65, 0]} receiveShadow>
      <boxGeometry args={[0.3, 1.3, d]} /><meshStandardMaterial color="#d7d4c9" />
    </mesh>
    <mesh position={[0, 3.15, -d / 2 + 0.01]}>
      <boxGeometry args={[w, 0.35, 0.08]} /><meshStandardMaterial color="#305e50" />
    </mesh>
    <mesh position={[0, 3.45, -d / 2 + 0.05]}>
      <boxGeometry args={[w - 0.4, 0.05, 0.1]} /><meshStandardMaterial color="#fff5d7" emissive="#fff5d7" emissiveIntensity={0.5} />
    </mesh>
  </group>;
}
