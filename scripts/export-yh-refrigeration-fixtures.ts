// Run from the repository: node --import tsx scripts/export-yh-refrigeration-fixtures.ts OUTPUT_DIR
import { strict as assert } from 'node:assert';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildRefrigerationFixture } from '../apps/web/src/scene/refrigerationFixture';
import { makeRefrigerationFixture } from '../apps/web/src/scene/refrigerationFixtureThree';

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
  { id: 'island', name: '玻璃滑盖卧式冰柜', file: 'yh-island-freezer.glb', sizeMm: [2502, 833, 853], dimensionReference: { name: 'AHT PARIS 250', url: 'https://no.aht.at/wp-content/uploads/2022/04/salesfolder_paris_de_2204.pdf' } },
  { id: 'upright', name: '立式双玻璃门冷柜', file: 'yh-upright-cooler.glb', sizeMm: [1350, 2035, 908], dimensionReference: { name: 'TEFCOLD EXTRA1250FD', url: 'https://www.tefcold.com/extra1250fd-38507' } },
  { id: 'open', name: '多层开放风幕柜', file: 'yh-open-multideck.glb', sizeMm: [2580, 2090, 915], dimensionReference: { name: 'Bromic FHM2500-NR', url: 'https://www.bromicrefrigeration.com.au/wp-content/uploads/2024/06/FHM2500-NR_SPEC_0324.pdf' } },
] as const;

const exporter = new GLTFExporter();
const models = [];
for (const spec of specs) {
  const model = buildRefrigerationFixture(spec.id);
  const group = makeRefrigerationFixture(model);
  group.updateMatrixWorld(true);
  const extent = new Box3().setFromObject(group, true);
  const rawBoundMm = extent.getSize(new Vector3()).toArray().map(m => m * 1000);
  assert.ok(!extent.isEmpty(), spec.id);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(rawBoundMm[i] - spec.sizeMm[i]) < .1, `${spec.id} unexpected size: ${rawBoundMm}`);
  }
  assert.ok(Math.abs(extent.min.y) < 1e-6 && Math.abs(extent.min.x + extent.max.x) < 1e-6
    && Math.abs(extent.min.z + extent.max.z) < 1e-6, `${spec.id} unexpected origin`);
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
  if(spec.id !== 'open') assert.ok(translucentMaterialOpacities.some(opacity => opacity > 0 && opacity < .5),
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
  if (spec.id !== 'open') assert.ok(glbAlpha.some(opacity => opacity > 0 && opacity < .5),
    `${spec.id} lost its glass transparency in GLB export`);
  await writeFile(resolve(directory, spec.file), new Uint8Array(binary));
  models.push({ ...spec, meshCount, triangles, measuredSizeMm: rawBoundMm.map(x => +x.toFixed(4)), translucentMaterialOpacities: [...new Set(translucentMaterialOpacities)], glbAlpha, mounts: model.mounts });
  console.log(`${spec.file}: ${rawBoundMm.map(x => x.toFixed(2)).join(' × ')} mm; ${meshCount} meshes, ${triangles} triangles`);
}
const manifest = {
  title: 'YH-TwinOps 尺寸化空冷柜',
  coordinateSpace: 'glTF: X width, Y up, Z depth; metres; bottom-centred; frontage +Z',
  dimensionsOrder: 'width × height × depth',
  provenance: 'Application Three.js factory (refrigerationFixture.ts + refrigerationFixtureThree.ts), actual mesh export, no merchandise. Offline render lighting is not the app scene.',
  clearanceNote: '模型用于教学场景，不是制造图、冷媒设计或性能认证。门/盖与商品均不含动画或库存数据。',
  models,
};
await writeFile(resolve(directory, 'refrigeration-dimensions.json'), JSON.stringify(manifest, null, 2) + '\n');
