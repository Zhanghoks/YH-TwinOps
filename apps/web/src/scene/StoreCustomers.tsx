import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Fixture, StoreLayout } from '@yh/contracts';
import { buildCustomerRoutes, customerPose } from './customerMotion';

const SHIRTS = ['#588b82', '#b96d59', '#d1ab59', '#627ea4', '#8f779e', '#e1d8c4', '#526c64'];
const TROUSERS = ['#364957', '#56534d', '#4b596f', '#6a6159'];
const SKIN = ['#e4b992', '#c58d67', '#996b4e', '#f0ccb0', '#b87f58'];
const HAIR = ['#302a28', '#534133', '#968675', '#22282a'];
const EMPTY_DECORATIONS: Fixture[] = [];
type V3 = readonly [number, number, number];

/** Original low-poly teaching figures, not observed customers or an operational crowd forecast.
 * Three instanced batches for the entire population. Geometry fits the routing body's .4m radius.
 */
export function StoreCustomers({ layout, decorations = EMPTY_DECORATIONS, paused = false }: {
  layout: StoreLayout; decorations?: Fixture[]; paused?: boolean;
}) {
  const routes = useMemo(() => buildCustomerRoutes(layout, decorations, 28), [layout, decorations]);
  const boxes = useRef<THREE.InstancedMesh>(null);
  const rounds = useRef<THREE.InstancedMesh>(null);
  const limbs = useRef<THREE.InstancedMesh>(null);
  const elapsed = useRef(0);
  const invalidate = useThree(s => s.invalidate);
  const scratch = useMemo(() => ({
    object: new THREE.Object3D(), color: new THREE.Color(),
    up: new THREE.Vector3(0, 1, 0), direction: new THREE.Vector3(),
    turn: new THREE.Quaternion(), localRotation: new THREE.Quaternion(),
  }), []);

  const update = (time: number, colors = false) => {
    const meshes = [boxes.current, rounds.current, limbs.current];
    if (meshes.some(mesh => !mesh)) return;
    const counts = [0, 0, 0];
    routes.forEach((route, i) => {
      const pose = customerPose(route, time, i);
      const height = .94 + (i % 5) * .035;
      const breadth = .91 + (i % 3) * .035;
      const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
      scratch.turn.setFromAxisAngle(scratch.up, pose.yaw);
      const shirt = SHIRTS[i % SHIRTS.length]!;
      const pants = TROUSERS[i % TROUSERS.length]!;
      const skin = SKIN[i % SKIN.length]!;
      const hair = HAIR[i % HAIR.length]!;
      const gait = pose.walking ? pose.stride : 0;
      const bob = pose.walking ? .008 * Math.abs(gait) : 0;
      const put = (batch: number, position: V3, size: V3, color: string, rotation?: THREE.Quaternion) => {
        const mesh = meshes[batch]!;
        const index = counts[batch]!;
        const x = position[0] * breadth, z = position[2] * breadth;
        scratch.object.position.set(pose.x + x * c + z * s, .018 + position[1] * height, pose.z - x * s + z * c);
        scratch.object.quaternion.copy(scratch.turn);
        if (rotation) scratch.object.quaternion.multiply(rotation);
        scratch.object.scale.set(size[0] * breadth, size[1] * height, size[2] * breadth);
        scratch.object.updateMatrix();
        mesh.setMatrixAt(index, scratch.object.matrix);
        if (colors) mesh.setColorAt(index, scratch.color.set(color));
        counts[batch] = index + 1;
      };
      const bone = (a: V3, b: V3, radius: number, color: string) => {
        scratch.direction.set(b[0]-a[0], b[1]-a[1], b[2]-a[2]);
        const length = scratch.direction.length();
        scratch.localRotation.setFromUnitVectors(scratch.up, scratch.direction.normalize());
        put(2, [(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2], [radius,length,radius], color, scratch.localRotation);
      };
      // Tailored torso/hem, rounded head and haircut create distinct silhouettes at aisle distance.
      put(0, [0,1.13+bob,0], [.35,.47,.225], shirt);
      put(0, [0,.865+bob,0], [.29,.14,.21], pants);
      bone([0,1.36+bob,0],[0,1.43+bob,0],.065,skin);
      put(1, [0,1.51+bob,.015], [.265,.30,.25], skin);
      put(1, [-.045,1.535+bob,.131], [.018,.018,.012], '#40382f');
      put(1, [.045,1.535+bob,.131], [.018,.018,.012], '#40382f');
      put(1, [0,1.49+bob,.143], [.037,.045,.035], skin);
      put(1, [0,1.605+bob,-.015], [.282,.17 + (i%3)*.012,.265], hair);
      // A ponytail on some figures; otherwise a small rear haircut detail, kept within body radius.
      put(1, [0,1.49+bob,-.125], i%4===1 ? [.10,.20,.12] : [.14,.11,.065], hair);
      for (const side of [-1,1]) {
        const step = gait * side;
        const lift = pose.walking ? .065 * Math.max(0, step) : 0;
        const hip: V3 = [side*.085,.86+bob,0];
        const knee: V3 = [side*.085,.46 + lift*.3,.065 + step*.075];
        const ankle: V3 = [side*.085,.12+lift,step*.18];
        bone(hip,knee,.067,pants);
        bone(knee,ankle,.052,pants);
        put(1,knee,[.12,.12,.12],pants);
        put(0,[side*.085,.055+lift,step*.18+.035],[.125,.11,.22],'#343a3d');
        const carrying = i%3!==0 && side===1;
        const shoulder: V3 = [side*.21,1.29+bob,0];
        const elbow: V3 = [side*.235,1.04+bob,carrying ? .055 : -step*.095];
        const hand: V3 = [side*.24,.84+bob,carrying ? .09 : -step*.15];
        bone(shoulder,elbow,.065,shirt);
        bone(elbow,hand,.043,skin);
        put(1,hand,[.085,.10,.085],skin);
      }
      // Small basket or tote; flat rim and raised handle remain separate recognizable parts.
      const carry = i%3!==0;
      const bagColor = i%3===1 ? '#bda174' : '#708e82';
      const w = carry ? .145 : 0;
      put(0,[.255,.62+bob,.085],[w,.25,carry?.19:0],bagColor);
      put(0,[.255,.745+bob,.085],[w*1.08,.035,carry?.20:0],i%3===1?'#927449':'#385d53');
      put(0,[.205,.815+bob,.085],[carry?.014:0,.13,.016],bagColor);
      put(0,[.305,.815+bob,.085],[carry?.014:0,.13,.016],bagColor);
      put(0,[.255,.88+bob,.085],[carry?.115:0,.016,.016],bagColor);
    });
    meshes.forEach((mesh, index) => {
      if (!mesh) return;
      mesh.count = counts[index]!;
      mesh.instanceMatrix.needsUpdate = true;
      if (colors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  };

  useLayoutEffect(() => {
    elapsed.current = 0;
    update(0, true);
    for (const mesh of [boxes.current,rounds.current,limbs.current]) mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    invalidate();
  }, [routes, invalidate]);
  useEffect(() => {
    if (paused) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () => {
      if (timer) clearInterval(timer);
      if (!document.hidden) timer = setInterval(invalidate, 1000/30);
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => { if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [paused, invalidate]);
  useFrame((_, delta) => {
    if (paused || document.hidden) return;
    elapsed.current += Math.min(delta,.1);
    update(elapsed.current);
  });
  const capacity = Math.max(1,routes.length*12);
  return <group name="synthetic-store-customers">
    <instancedMesh ref={boxes} args={[undefined,undefined,capacity]} frustumCulled={false}>
      <boxGeometry args={[1,1,1]}/><meshLambertMaterial/>
    </instancedMesh>
    <instancedMesh ref={rounds} args={[undefined,undefined,capacity]} frustumCulled={false}>
      <sphereGeometry args={[.5,8,6]}/><meshLambertMaterial/>
    </instancedMesh>
    <instancedMesh ref={limbs} args={[undefined,undefined,capacity]} frustumCulled={false}>
      <cylinderGeometry args={[1,1,1,6]}/><meshLambertMaterial/>
    </instancedMesh>
  </group>;
}
