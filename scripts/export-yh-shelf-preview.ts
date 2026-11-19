// Export the component inspector's exact near-LOD part geometry for offline QA.
import { deepStrictEqual, ok } from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildComponentSample } from '../apps/web/src/scene/componentCatalog';
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
if (!directory) throw new Error('Usage: node --import tsx scripts/export-yh-shelf-preview.ts OUTPUT_DIRECTORY');
await mkdir(directory, { recursive: true });
const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(.5, 8, 6);
const exporter = new GLTFExporter();
for (const sample of ['grocery', 'household'] as const) {
  const fixture = buildComponentSample(sample);
  const structure = buildFixtureDetail(fixture, { stocked: false });
  for (const stocked of [false, true]) {
    const parts = stocked ? buildFixtureDetail(fixture, { stocked: true }) : structure;
    ok(parts.length > 0 && (!stocked || parts.length > structure.length), `Missing geometry: ${sample}`);
    deepStrictEqual(parts.slice(0, structure.length), structure, `Structure changed: ${sample}`);
    const scene = new THREE.Scene();
    const rack = new THREE.Group();
    rack.name = fixture.fixtureId;
    rack.position.set(fixture.x, fixture.y, fixture.z);
    rack.rotation.y = fixture.rotationY;
    scene.add(rack);
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    for (const part of parts) {
      const key = `${part.material}:${part.color}`;
      let material = materials.get(key);
      if (!material) {
        material = new THREE.MeshStandardMaterial({
          color: part.color,
          roughness: part.material === 'metal' ? .49 : .68,
          metalness: part.material === 'metal' ? .22 : 0,
        });
        material.name = key;
        materials.set(key, material);
      }
      const mesh = new THREE.Mesh(part.primitive === 'box' ? box : sphere, material);
      mesh.name = part.id;
      mesh.position.set(...part.position);
      mesh.scale.set(...part.size);
      rack.add(mesh);
    }
    const binary = await exporter.parseAsync(scene, { binary: true, trs: true });
    if (!(binary instanceof ArrayBuffer)) throw new Error('Expected binary glTF');
    const name = `${sample}-${stocked ? 'stocked' : 'empty'}`;
    await writeFile(resolve(directory, `${name}.glb`), new Uint8Array(binary));
    console.log(`${name}: ${parts.length} meshes, ${binary.byteLength} bytes`);
    for (const material of materials.values()) material.dispose();
  }
}
box.dispose();
sphere.dispose();
