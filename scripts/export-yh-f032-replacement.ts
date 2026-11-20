// Export the component inspector's exact near-LOD part geometry for offline QA.
import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { layout as baselineLayout } from '../apps/web/src/data';
import { generatePlanningLayout } from '../apps/web/src/scene/planningLayout';
import { buildShelfPlanogram } from '../apps/web/src/scene/shelfDisplay';
import { buildF032Replacement } from '../apps/web/src/scene/f032Replacement';
import { makeF032Replacement } from '../apps/web/src/scene/f032ReplacementThree';
import { buildFixtureDetail } from '../apps/web/src/scene/detailGeometry';

// GLTFExporter uses browser FileReader for binary blobs. No browser is needed.
class BinaryFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then(result => {
      this.result = result;
      this.onloadend?.();
    });
  }
}
Object.defineProperty(globalThis, 'FileReader', { value: BinaryFileReader });

const directory = process.argv[2];
if (!directory) throw new Error('Usage: node --import tsx scripts/export-yh-f032-replacement.ts OUTPUT_DIRECTORY');
await mkdir(directory, { recursive: true });
const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(.5, 8, 6);
const exporter = new GLTFExporter();
const fixture = generatePlanningLayout(baselineLayout).layout.fixtures.find(f => f.fixtureId === 'F032');
ok(fixture && fixture.fixtureType === 'GONDOLA', 'Dense F032 fixture is missing');
const previousSlots = buildShelfPlanogram(fixture);
const previousSlotCount = previousSlots.length;
const parts = buildFixtureDetail(fixture, { stocked: true, lod: 'near' });
const legacy = new THREE.Group();
legacy.name = 'F032 Dense Legacy Stocked';
const materials = new Map<string, THREE.MeshStandardMaterial>();
for (const part of parts) {
  const key = `${part.material}:${part.color}`;
  let material = materials.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      name: key,
      color: part.color,
      roughness: .78,
      metalness: part.material === 'metal' ? .48 : 0,
      transparent: part.material === 'glass',
      opacity: part.material === 'glass' ? .25 : 1,
      depthWrite: part.material !== 'glass',
    });
    materials.set(key, material);
  }
  const mesh = new THREE.Mesh(part.primitive === 'box' ? box : sphere, material);
  mesh.name = part.id;
  mesh.position.set(...part.position);
  mesh.scale.set(...part.size);
  legacy.add(mesh);
}
const stocked = buildF032Replacement(fixture, { stocked: true, lod: 'near' });
const empty = buildF032Replacement(fixture, { stocked: false, lod: 'near' });
ok(stocked && empty, 'New F032 trial is unavailable in the dense layout');
equal(stocked.placements.length, previousSlotCount);
equal(empty.placements.length, 0);
deepStrictEqual(stocked.placements.map(p => [p.sourceId,p.slot.model,p.slot.color]).sort(),
  previousSlots.map(p => [p.id,p.model,p.color]).sort());
const scales = stocked.placements.map(p => p.scale);
const models = [];
for (const [id, group] of [
  ['before', legacy],
  ['after', makeF032Replacement(stocked,{batch: false})],
  ['empty', makeF032Replacement(empty,{batch: false})],
] as const) {
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group, true);
  const actualSizeMm = bounds.getSize(new THREE.Vector3()).toArray().map(m => +(m*1000).toFixed(4));
  if (id !== 'before') for (const [i,expected] of [7200,1600,1000].entries()) {
    ok(Math.abs(actualSizeMm[i] - expected) < .1, `${id} unexpected assembled dimensions: ${actualSizeMm}`);
  }
  const binary = await exporter.parseAsync(group, { binary: true, trs: true });
  ok(binary instanceof ArrayBuffer, `Invalid GLB for ${id}`);
  const file = `yh-f032-${id}.glb`;
  await writeFile(resolve(directory, file), new Uint8Array(binary));
  models.push({ id, file, actualSizeMm });
  console.log(`${id}: ${actualSizeMm.join(' × ')} mm`);
}
await writeFile(resolve(directory,'f032-replacement.json'), JSON.stringify({
  fixtureId: fixture.fixtureId,
  layout: 'dense',
  dimensionsOrder: 'width × height × depth',
  coordinates: 'GLB exported in fixture-local coordinates; meters, X along aisle, Y up, Z across two faces',
  fixtureTransform: { x: fixture.x, y: fixture.y, z: fixture.z, rotationY: fixture.rotationY },
  oldEnvelopeMm: [fixture.widthM,fixture.heightM,fixture.depthM].map(m=>m*1000),
  existingMerchandiseCount: previousSlotCount,
  retainedModelCounts: Object.fromEntries([...new Set(previousSlots.map(s => s.model))].map(model =>
    [model, previousSlots.filter(s => s.model === model).length])),
  relocatedMerchandiseCount: stocked.placements.length,
  scaledMerchandiseCount: scales.filter(scale => scale < 1 - 1e-8).length,
  minimumScale: Math.min(...scales),
  rackOffsetsM: stocked.rackOffsetsM,
  relocatedPlacements: stocked.placements.map(({ sourceId,slot,mount,rackIndex,scale }) => ({
    sourceId, rackIndex, mountId: mount.id, model: slot.model, color: slot.color, anchorM: slot.anchor, sizeM: slot.modelSize, scale,
  })),
  visualScope: 'Only the target fixture is shown. Exact geometry and baseline colors; studio lighting and no old procedural surface maps. This is not a screenshot of the entire supermarket.',
  modelSources: 'Before: app detailGeometry.ts + planningLayout.ts; after/empty: app f032Replacement.ts and f032ReplacementThree.ts',
  models,
}, null, 2)+'\n');
box.dispose();
sphere.dispose();
