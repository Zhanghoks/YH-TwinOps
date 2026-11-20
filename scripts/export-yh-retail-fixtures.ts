// Run from the repository: node --import tsx scripts/export-yh-retail-fixtures.ts OUTPUT_DIR
import { strict as assert } from 'node:assert';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildRetailFixture } from '../apps/web/src/scene/retailFixture';
import { makeRetailFixture } from '../apps/web/src/scene/retailFixtureThree';

// GLTFExporter uses FileReader for its binary Blob in browsers.
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
if (!directory) throw new Error('Pass an output directory');
await mkdir(directory, { recursive: true });
const specs = [
  { id: 'produce', name: '果蔬陈列岛台', file: 'yh-produce-island.glb', expectedSizeMm: [1220,940,1450],
    dimensionReference: { name:'Wood Arts Produce Table Collection', url:'https://www.woodarts.ca/uploads/1/2/0/2/120293253/produce_table_collection_feb_2022.pdf', note:'整毫米取值，含建模设计护边。' } },
  { id: 'service', name: '玻璃服务柜', file: 'yh-service-display.glb', expectedSizeMm: [1955,1290,1086],
    dimensionReference: { name:'Bromic DD1875CG-NR', url:'https://www.bromicrefrigeration.com.au/wp-content/uploads/2023/08/DD1875CG-NR_SPEC_0524.pdf' } },
  { id: 'checkout', name: '人工收银通道', file: 'yh-checkout-lane.glb', expectedSizeMm: [2500,1150,1120], worktopMm: 860,
    dimensionReference: { name:'ITAB Alco checkouts', url:'https://itab.com/products-and-services/products/retail-technology/belted-checkout-solutions/alco-checkouts', note:'收银台面 860 mm；POS 模型全高 1150 mm 为设计值。' } },
] as const;

const exporter = new GLTFExporter();
const models = [];
for (const spec of specs) {
  const model = buildRetailFixture(spec.id);
  const sizeMm = [model.dimensionsMm.width, model.dimensionsMm.height, model.dimensionsMm.depth];
  assert.deepEqual(sizeMm, [...spec.expectedSizeMm], spec.id);
  const group = makeRetailFixture(model);
  group.updateMatrixWorld(true);
  const extent = new Box3().setFromObject(group, true);
  const rawBoundMm = extent.getSize(new Vector3()).toArray().map(m => m * 1000);
  assert.ok(!extent.isEmpty(), spec.id);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(rawBoundMm[i] - sizeMm[i]) < .1, `${spec.id} unexpected size: ${rawBoundMm}`);
  }
  assert.ok(Math.abs(extent.min.y) < 1e-6 && Math.abs(extent.min.x + extent.max.x) < 1e-6
    && Math.abs(extent.min.z + extent.max.z) < 1e-6, `${spec.id} unexpected origin`);
  let measuredWorktopMm: number | undefined;
  if ('worktopMm' in spec) {
    for (const name of ['black-checkout-belt', 'bagging-deck']) {
      const surface = group.getObjectByName(name);
      assert.ok(surface instanceof Mesh, `Missing ${name}`);
      const actualMm = new Box3().setFromObject(surface, true).max.y * 1000;
      assert.ok(Math.abs(actualMm - spec.worktopMm) < .1, `Bad height for ${name}: ${actualMm}`);
      measuredWorktopMm = +actualMm.toFixed(4);
    }
  }
  let meshCount = 0;
  let triangles = 0;
  const translucentMaterialOpacities: number[] = [];
  group.traverse(node => {
    if (!(node instanceof Mesh)) return;
    meshCount++;
    triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material.transparent && material.opacity < 1) translucentMaterialOpacities.push(material.opacity);
    }
  });
  assert.ok(meshCount > 0 && triangles > 0, spec.id);
  if(spec.id === 'service') assert.ok(translucentMaterialOpacities.some(opacity => opacity > 0 && opacity < .5),
    `${spec.id} glass is absent or too opaque`);
  const binary = await exporter.parseAsync(group, { binary: true, trs: true });
  assert.ok(binary instanceof ArrayBuffer, spec.id);
  const header = new DataView(binary);
  assert.equal(header.getUint32(0, true), 0x46546c67, 'Expected GLB magic');
  assert.equal(header.getUint32(16, true), 0x4e4f534a, 'Expected GLB JSON chunk');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(binary, 20, header.getUint32(12, true)))) as {
    materials?: { alphaMode?: string; pbrMetallicRoughness?: { baseColorFactor?: number[] } }[];
  };
  const glbAlpha = (json.materials ?? []).flatMap(material => material.alphaMode === 'BLEND'
    ? [material.pbrMetallicRoughness?.baseColorFactor?.[3] ?? 1] : []);
  if (spec.id === 'service') assert.ok(glbAlpha.some(opacity => opacity > 0 && opacity < .5),
    `${spec.id} lost its glass transparency in GLB export`);
  await writeFile(resolve(directory, spec.file), new Uint8Array(binary));
  models.push({ ...spec, sizeMm, meshCount, triangles, measuredWorktopMm, measuredSizeMm: rawBoundMm.map(x => +x.toFixed(4)), translucentMaterialOpacities: [...new Set(translucentMaterialOpacities)], glbAlpha, mounts: model.mounts });
  console.log(`${spec.file}: ${rawBoundMm.map(x => x.toFixed(2)).join(' × ')} mm; ${meshCount} meshes, ${triangles} triangles`);
}
const manifest = {
  title: 'YH-TwinOps 尺寸化空台柜',
  coordinateSpace: 'glTF: X width, Y up, Z depth; metres; bottom-centred; frontage +Z',
  dimensionsOrder: 'width × height × depth',
  provenance: 'Application Three.js factory (retailFixture.ts + retailFixtureThree.ts), actual mesh export, no merchandise. Offline render lighting is not the app scene.',
  clearanceNote: '模型用于教学场景，不是制造图、设备性能或工程认证。柜体无门盖动画或库存数据。',
  models,
};
await writeFile(resolve(directory, 'retail-dimensions.json'), JSON.stringify(manifest, null, 2) + '\n');
