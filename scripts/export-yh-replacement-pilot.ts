// Export the component inspector's exact near-LOD part geometry for offline QA.
import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { layout as baselineLayout } from '../apps/web/src/data';
import { generatePlanningLayout } from '../apps/web/src/scene/planningLayout';
import { buildShelfPlanogram } from '../apps/web/src/scene/shelfDisplay';
import { buildShelfGroupReplacement } from '../apps/web/src/scene/shelfGroupReplacement';
import { makeShelfGroupReplacement } from '../apps/web/src/scene/shelfGroupReplacementThree';
import { buildFreshGroupReplacement } from '../apps/web/src/scene/freshGroupReplacement';
import { makeFreshGroupReplacement } from '../apps/web/src/scene/freshGroupReplacementThree';
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
if (!directory) throw new Error('Usage: node --import tsx scripts/export-yh-replacement-pilot.ts OUTPUT_DIRECTORY');
await mkdir(directory, { recursive: true });
const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(.5, 8, 6);
const exporter = new GLTFExporter();
const dense = generatePlanningLayout(baselineLayout).layout;
const rows = [];
for (const [fixtureId, label] of [
  ['F077','包装食品'], ['F107','日化用品'], ['F029','果蔬岛台'], ['F050','冷冻岛柜'],
] as const) {
  const fixture = dense.fixtures.find(f => f.fixtureId === fixtureId);
  ok(fixture, `Missing dense fixture ${fixtureId}`);
  const shelf = fixtureId === 'F077' || fixtureId === 'F107';
  const oldParts = buildFixtureDetail(fixture, { stocked: true, lod: 'near' });
  const legacy = new THREE.Group();
  legacy.name = `${fixtureId} Dense Legacy Stocked`;
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  for (const part of oldParts) {
    const key = `${part.material}:${part.color}`;
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        name: key, color: part.color, roughness: .78,
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
  let after: THREE.Group, emptyAfter: THREE.Group;
  let previousSignatures: [string,string,string][];
  let relocatedPlacements: {
    sourceId:string; moduleIndex:number; mountId:string; model:string; color:string;
    anchorM:readonly[number,number,number]; sizeM:readonly[number,number,number]; scale:number;
    pitchRad?:number; localCenterM?:readonly[number,number,number];
  }[];
  let moduleOffsets: readonly number[]|readonly (readonly number[])[];
  let plannedStockedEnvelopeMm: number[];
  if (shelf) {
    const stocked = buildShelfGroupReplacement(fixture, { stocked: true, lod: 'near' });
    const empty = buildShelfGroupReplacement(fixture, { stocked: false, lod: 'near' });
    ok(stocked && empty, `No safe shelf trial for ${fixtureId}`);
    equal(empty.placements.length, 0, fixtureId);
    after = makeShelfGroupReplacement(stocked, {batch:false});
    emptyAfter = makeShelfGroupReplacement(empty, {batch:false});
    moduleOffsets = stocked.rackOffsetsM;
    plannedStockedEnvelopeMm = stocked.replacementEnvelopeM.map(m => m*1000);
    previousSignatures = buildShelfPlanogram(fixture).map(p => [p.id,p.model,p.color]);
    relocatedPlacements = stocked.placements.map(({ sourceId,slot,mount,rackIndex,scale }) => ({
      sourceId, moduleIndex:rackIndex, mountId:mount.id, model:slot.model, color:slot.color, anchorM:slot.anchor, sizeM:slot.modelSize, scale,
    }));
  } else {
    const stocked = buildFreshGroupReplacement(fixture, { stocked: true, lod: 'near' });
    const empty = buildFreshGroupReplacement(fixture, { stocked: false, lod: 'near' });
    ok(stocked && empty, `No safe fresh trial for ${fixtureId}`);
    equal(empty.placements.length, 0, fixtureId);
    after = makeFreshGroupReplacement(stocked, {batch:false});
    emptyAfter = makeFreshGroupReplacement(empty, {batch:false});
    moduleOffsets = stocked.offsets;
    plannedStockedEnvelopeMm = stocked.replacementEnvelopeM.map(m => m*1000);
    const products = oldParts.filter(part => (fixtureId === 'F029' ? /^crate-\d-\d-fruit-\d+$/ : /^chilled-pack-\d-\d+$/).test(part.id));
    previousSignatures = products.map(p => [p.id,p.primitive,p.color]);
    relocatedPlacements = stocked.placements.map(({sourceId,sourcePart,moduleIndex,mountId,anchor,pitchRad,scale,localCenter}) => ({
      sourceId,moduleIndex,mountId,model:sourcePart.primitive,color:sourcePart.color,anchorM:anchor,
      sizeM:[sourcePart.size[0]*scale,sourcePart.size[1]*scale,sourcePart.size[2]*scale],pitchRad,scale,localCenterM:localCenter,
    }));
  }
  deepStrictEqual(relocatedPlacements.map(p => [p.sourceId,p.model,p.color]).sort(), previousSignatures.sort(), fixtureId);
  const scales = relocatedPlacements.map(p => p.scale);
  const models = [];
  for (const [variant, group] of [
    ['before', legacy],
    ['after', after],
    ['empty', emptyAfter],
  ] as const) {
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group, true);
    const actualSizeMm = bounds.getSize(new THREE.Vector3()).toArray().map(m => +(m*1000).toFixed(4));
    ok(actualSizeMm.every(x => x > 0), `Empty geometry: ${fixtureId}-${variant}`);
    ok(Math.abs(bounds.min.y) < 1e-6, `Ground mismatch: ${fixtureId}-${variant}`);
    const binary = await exporter.parseAsync(group, { binary: true, trs: true });
    ok(binary instanceof ArrayBuffer, `Invalid GLB for ${fixtureId}-${variant}`);
    const file = `yh-${fixtureId.toLowerCase()}-${variant}.glb`;
    await writeFile(resolve(directory, file), new Uint8Array(binary));
    models.push({ variant, file, actualSizeMm });
    console.log(`${fixtureId}-${variant}: ${actualSizeMm.join(' × ')} mm`);
  }
  rows.push({ fixtureId, label,
    fixtureTransform: { x: fixture.x, y: fixture.y, z: fixture.z, rotationY: fixture.rotationY },
    oldEnvelopeMm: [fixture.widthM,fixture.heightM,fixture.depthM].map(m=>m*1000),
    existingMerchandiseCount: previousSignatures.length,
    retainedModelCounts: Object.fromEntries([...new Set(previousSignatures.map(p => p[1]))].map(model =>
      [model, previousSignatures.filter(p => p[1] === model).length])),
    relocatedMerchandiseCount: relocatedPlacements.length,
    scaledMerchandiseCount: scales.filter(scale => scale < 1 - 1e-8).length,
    minimumScale: Math.min(...scales),
    moduleOffsets, plannedStockedEnvelopeMm,
    relocatedPlacements,
    models,
  });
  for (const material of materials.values()) material.dispose();
}
await writeFile(resolve(directory,'fixture-pilot.json'), JSON.stringify({
  layout: 'dense',
  dimensionsOrder: 'width × height × depth',
  coordinates: 'GLB in fixture-local coordinates; meters, X along aisle, Y up, Z across two faces',
  visualScope: 'Individual target fixtures only. Geometry from actual app factories. Studio lighting; old procedural surface maps excluded. Not a web screenshot.',
  modelSources: 'Before: app detailGeometry.ts and planningLayout.ts; after/empty: app shelfGroupReplacement and freshGroupReplacement Three.js factories',
  rows,
}, null, 2)+'\n');
box.dispose();
sphere.dispose();
