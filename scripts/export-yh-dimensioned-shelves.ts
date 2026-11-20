// Run from the repository: node --import tsx scripts/export-yh-dimensioned-shelves.ts OUTPUT_DIR
import { strict as assert } from 'node:assert';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildDimensionedShelf } from '../apps/web/src/scene/dimensionedShelf';
import { makeDimensionedShelf } from '../apps/web/src/scene/dimensionedShelfThree';

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
  { id: 'wall', name: '单面靠墙架', kind: 'wall', file: 'yh-wall-shelf.glb',
    sizeMm: [2400, 2200, 470], deckTopsMm: [150,530,910,1290,1670], sides: 1, bays: 1, rearAssemblyDepthMm: 50, rearAssemblyNote: '50 mm 为单面架建模假设，不是参考原图标注。' },
  { id: 'island', name: '双面中岛架', kind: 'gondola', file: 'yh-island-shelf.glb',
    sizeMm: [2400, 1600, 1000], deckTopsMm: [200,500,800,1100,1400], sides: 2, bays: 2,
    spineDepthMm: 100, deckDepthPerSideMm: 450 },
] as const;
const exporter = new GLTFExporter();
const models = [];
for (const spec of specs) {
  const model = buildDimensionedShelf(spec.kind);
  const deckParts = model.parts.filter(part => part.id.startsWith('deck-'));
  assert.equal(deckParts.length, spec.sides * spec.bays * spec.deckTopsMm.length, spec.id);
  assert.equal(model.mounts.length, deckParts.length, spec.id);
  for (const mount of model.mounts) {
    assert.ok(Math.abs(mount.anchor[1] * 1000 - spec.deckTopsMm[mount.level]) < .001, mount.id);
  }
  if ('deckDepthPerSideMm' in spec) {
    assert.equal(model.dimensionsMm.spine, spec.spineDepthMm);
    deckParts.forEach(part => assert.ok(Math.abs((part.max[2] - part.min[2]) * 1000 - spec.deckDepthPerSideMm) < .001, part.id));
  }
  if ('rearAssemblyDepthMm' in spec) assert.equal(model.dimensionsMm.spine, spec.rearAssemblyDepthMm);
  const group = makeDimensionedShelf(model);
  group.updateMatrixWorld(true);
  const extent = new Box3().setFromObject(group, true);
  assert.ok(!extent.isEmpty(), spec.id);
  const rawBoundMm = extent.getSize(new Vector3()).toArray().map(m => m * 1000);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(rawBoundMm[i] - spec.sizeMm[i]) < .1, `${spec.id} unexpected size: ${rawBoundMm}`);
  }
  // The geometry is bottom-centred, not a displaced bounding-box proxy.
  assert.ok(Math.abs(extent.min.y) < 1e-6 && Math.abs(extent.min.x + extent.max.x) < 1e-6
    && Math.abs(extent.min.z + extent.max.z) < 1e-6, `${spec.id} unexpected origin`);
  const meshDeckTopsMm: number[] = [];
  let meshCount = 0;
  let triangles = 0;
  group.traverse(node => {
    if (!(node instanceof Mesh)) return;
    if (node.name.startsWith('deck-')) {
      const deckBounds = new Box3().setFromObject(node, true);
      meshDeckTopsMm.push(Math.round(deckBounds.max.y * 1000));
      if ('deckDepthPerSideMm' in spec) {
        assert.ok(Math.abs((deckBounds.max.z - deckBounds.min.z) * 1000 - spec.deckDepthPerSideMm) < .1, node.name);
      }
    }
    meshCount++;
    triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3;
  });
  const measuredDeckTopsMm = [...new Set(meshDeckTopsMm)].sort((a,b) => a-b);
  assert.deepEqual(measuredDeckTopsMm, [...spec.deckTopsMm], spec.id);
  assert.equal(meshDeckTopsMm.length, deckParts.length, spec.id);
  assert.ok(meshCount > 0 && triangles > 0, spec.id);
  const binary = await exporter.parseAsync(group, { binary: true, trs: true });
  assert.ok(binary instanceof ArrayBuffer, spec.id);
  await writeFile(resolve(directory, spec.file), new Uint8Array(binary));
  models.push({ ...spec, meshCount, triangles, measuredDeckTopsMm, measuredSizeMm: rawBoundMm.map(x => +x.toFixed(4)) });
  console.log(`${spec.file}: ${rawBoundMm.map(x => x.toFixed(2)).join(' × ')} mm; ${meshCount} meshes, ${triangles} triangles`);
}
const manifest = {
  title: 'YH-TwinOps 尺寸化空货架',
  coordinateSpace: 'glTF: X width, Y up, Z depth; metres; bottom-centred; wall frontage +Z',
  dimensionsOrder: 'width × height × depth',
  provenance: 'Application Three.js factory (dimensionedShelf.ts + dimensionedShelfThree.ts), actual mesh export, no merchandise; reference images supplied by user. Offline render lighting is not the app scene.',
  islandPitchNote: '中岛以 1600 mm 总高与给定 200 / 500 / 800 / 1100 / 1400 mm 层板顶标高为准，实际层距 300 mm。参考示意的 350 mm 不采用。',
  clearanceNote: '模型为参考建模尺寸，不是供应商承载或可制造性认证。',
  models,
};
await writeFile(resolve(directory, 'shelf-dimensions.json'), JSON.stringify(manifest, null, 2) + '\n');
