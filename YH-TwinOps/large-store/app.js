/* YH TwinOps: demonstrable browser-only digital-twin MVP.
 * Data is synthetic. Based on the published hand-drawn observational sketch,
 * not a measured/as-built Yonghui store floorplan.
 * Three.js is intentionally used without a parallel 3D engine.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeSimulationEngine } from './simulation.js';

const layout = await fetch('./layout.json').then(r => {if(!r.ok) throw new Error('layout.json 加载失败'); return r.json()});
const zones = layout.zones;
const Z = Object.fromEntries(zones.map(z => [z.id,z]));
const $ = id => document.getElementById(id);
const mount = $('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111b1b);
scene.fog = new THREE.FogExp2(0x111b1b, 0.006);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled=false;
mount.appendChild(renderer.domElement);
const camera = new THREE.OrthographicCamera(-80,80,60,-60,.1,550);
const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.075;
controls.maxPolarAngle=Math.PI/2.1;
controls.minPolarAngle=.18;
controls.minZoom=.45;
controls.maxZoom=5.2;
controls.target.set(0,0,0);
function resetCamera(top=false){
 camera.position.set(top?0:76,top?110:78,top?.01:91);
 controls.target.set(0,0,0);controls.update();
}
resetCamera();
scene.add(new THREE.HemisphereLight(0xe5fff0,0x34413e,2.1));
const sun=new THREE.DirectionalLight(0xfff3d6,2.1);sun.position.set(-32,67,38);scene.add(sun);
const fill=new THREE.DirectionalLight(0x8ac6e0,.6);fill.position.set(32,28,-30);scene.add(fill);
const ambientPoint=new THREE.PointLight(0xffddad,280,105);ambientPoint.position.set(0,26,0);scene.add(ambientPoint);
scene.add(new THREE.GridHelper(100,50,0x31443c,0x283832));

const boxGeo=new THREE.BoxGeometry(1,1,1);
function meshBox(x,y,z,w,h,d,color,metalness=0){
 const m=new THREE.Mesh(boxGeo,new THREE.MeshStandardMaterial({color,roughness:.78,metalness}));
 m.position.set(x,y,z);m.scale.set(w,h,d);return m;
}
function staticGeometry(){
 const floor=meshBox(0,-.23,0,80,.46,50,0x919b98);
 scene.add(floor);
 // subtle tile grid
 const g=new THREE.GridHelper(80,80,0x777e78,0x87918a);g.position.y=.009;scene.add(g);
 // cutaway: back and side walls, low transparent front parapet
 scene.add(meshBox(-39.93,1.85,0,.2,3.7,50,0x414a49));
 scene.add(meshBox(39.93,1.85,0,.2,3.7,50,0x414a49));
 scene.add(meshBox(0,1.85,-24.93,80,3.7,.2,0x414a49));
 for(const [x,w] of [[-35,9],[-18,5],[1,30],[29,21]]){
  scene.add(meshBox(x,.42,24.95,w,.84,.18,0x677471));
 }
 // zone highlights use geometry from data, not a texture screenshot
 for(const z of zones){
  const mat=new THREE.MeshBasicMaterial({color:z.color,transparent:true,opacity:.09,depthWrite:false,side:THREE.DoubleSide});
  const pane=new THREE.Mesh(new THREE.PlaneGeometry(z.w,z.d),mat);
  pane.rotation.x=-Math.PI/2;pane.position.set(z.x,.026,z.z);scene.add(pane);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(z.w,.04,z.d)),new THREE.LineBasicMaterial({color:z.color,transparent:true,opacity:.3}));
  edge.position.set(z.x,.06,z.z);scene.add(edge);
 }
 // gray roof beams/spot strips, ceiling deliberately omitted to see the plan
 for(let x=-31;x<=33;x+=10){
  const beam=meshBox(x,5.5,0,.16,.16,48,0x65706b);scene.add(beam);
  for(let z=-20;z<24;z+=8){
   const lamp=meshBox(x,5.25,z,.7,.13,.42,0xffe8bd);scene.add(lamp);
  }
 }
 for(const x of [-30,-15,0,15,30]) for(const z of [-18,0,18]){
  scene.add(meshBox(x,2.6,z,.52,5.2,.52,0x646d6b));
 }
 // entrance arch and independent checkpoint signage
 for(const [x,z,name] of [[-23,25,'入口'],[-11,25,'出口 03'],[0,-25,'出口 01'],[40,2,'出口 02']]){
  const sig=makeLabel(name,'#317d59',720,170);sig.position.set(Math.min(39,Math.max(-39,x)),3.8,Math.min(24,Math.max(-24,z)));sig.scale.set(6.5,1.65,1);scene.add(sig);
 }
}
function makeLabel(text,color='#386950',width=860,height=180){
 const c=document.createElement('canvas');c.width=width;c.height=height;
 const g=c.getContext('2d');
 g.fillStyle=color;g.beginPath();g.roundRect(14,18,width-28,height-36,22);g.fill();
 g.strokeStyle='#b4f6cb';g.lineWidth=4;g.stroke();
 g.fillStyle='#fafff8';g.textAlign='center';g.textBaseline='middle';
 g.font=`bold ${text.length>8?54:67}px "PingFang SC", "Microsoft YaHei", sans-serif`;
 g.fillText(text,width/2,height/2+4,width-36);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 return new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
}
const labels=new THREE.Group();scene.add(labels);
for(const z of zones){
 if(z.id.startsWith('checkout')||z.id==='backroom'||z.id==='rest')continue;
 const lab=makeLabel(z.name.split(' / ')[0],z.color);
 lab.position.set(z.x,3.3,z.z);lab.scale.set(Math.max(5,Math.min(9,z.w*.55)),1.85,1);labels.add(lab);
}
const selectMeshes=[];
for(const z of zones){
 const p=new THREE.Mesh(new THREE.PlaneGeometry(z.w,z.d),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
 p.rotation.x=-Math.PI/2;p.position.set(z.x,.095,z.z);p.userData.zoneId=z.id;
 selectMeshes.push(p);scene.add(p);
}
staticGeometry();
let fixtureGroup=new THREE.Group(),heatGroup=new THREE.Group(),customerGroup=new THREE.Group();
scene.add(fixtureGroup,heatGroup,customerGroup);
let activeFixtures=layout.fixtures;
let simulated=null;
let activePlan='base';
let heatEnabled=false;
let activeView='3d';
let shouldPlay=true;
let clockValue=0;
const decorRnd=(k)=>{let s=(k*73856093+19349663)>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)};
function buildFixtureVisual(fixtures){
 scene.remove(fixtureGroup);fixtureGroup.traverse(o=>{if(o.isInstancedMesh){o.material.dispose()}});
 fixtureGroup=new THREE.Group();scene.add(fixtureGroup);
 const batches=new Map();
 const put=(x,y,z,w,h,d,color)=>{
  if(!batches.has(color))batches.set(color,[]);
  batches.get(color).push([x,y,z,w,h,d]);
 };
 const pall={
  produce:['#e24e3f','#eaba3c','#70a64d','#b1c853','#ec9137','#ba4848'],
  meat:['#c16a70','#efae9e','#a04d5b'],seafood:['#9dc7d4','#c0e0de','#77b2c2'],
  deli:['#d5a15b','#bb693b','#ddc18a'],bakery:['#c48e4e','#d7a86a','#e5c998'],
  frozen:['#dee9ec','#a5cee6','#b2b8d9'],beverages:['#d69e4a','#71a98c','#6e95b7'],
  household:['#b9b9d2','#9bb0c9','#c8d4b2'],
  bulk:['#dec08d','#bea86d','#ac975e']
 };
 for(const [index,f] of fixtures.entries()){
  const {x,z,w,d,height:h,type,zoneId}=f;
  const colors=pall[zoneId]||['#e3ba84','#91b6ab','#c09da0','#b8a9c3','#d3b489'];
  const rnd=decorRnd(index+12);
  const pick=()=>colors[Math.floor(rnd()*colors.length)];
  if(type==='produce'){
   put(x,.4,z,w,.8,d,'#7a5b3f');put(x,.86,z,w,.12,d,'#c0a175');
   for(let i=0;i<7;i++)for(let j=0;j<3;j++){
    const px=x+(i-3)*w/8.1, pz=z+(j-1)*d/3.8;
    put(px,.98,pz,w/10,.21,d/5.4,pick());
   }
  }else if(type==='checkout'){
   put(x,.43,z,w,.86,d,'#4a5554');put(x,.92,z,w,.08,d,'#c9d3cc');
   put(x,h+.20,z-.24,.38,.44,.13,'#19383c');put(x,h+.46,z-.24,.43,.07,.18,'#7cd4ad');
  }else if(type==='fridge'||type==='freezer'){
   put(x,h*.5,z,w,h,d,'#94b1ba');put(x,h+.045,z,w+.05,.08,d+.05,'#d8eced');
   for(let i=0;i<6;i++)put(x+(i-2.5)*w/7,h+.12,z,.2,.11,d*.37,pick());
  }else if(type==='service'||type==='bakery'||type==='bulk'){
   put(x,h*.43,z,w,h*.86,d,type==='bakery'?'#664f39':'#616968');
   put(x,h*.93,z,w+.09,.14,d+.09,'#d1d4cc');
   for(let i=0;i<7;i++)put(x+(i-3)*w/7.8,h+.12,z,.23,.21,d*.48,pick());
  }else if(type==='gondola'){
   put(x,h*.5,z,w,h,d,'#394947');
   for(let lev=0;lev<5;lev++){
    const y=.22+lev*(h-.22)/5;
    put(x,y,z,w,.07,d+.15,'#aeb9b2');
    for(let i=0;i<8;i++)for(let side of [-1,1]){
     put(x+(i-3.5)*w/8.5,y+.18,z+side*.29,w/12,.29,.20,pick());
    }
   }
  }else if(type==='bench'){
   put(x,.48,z,w,.32,d,'#ad8b5e');
   for(let s of [-1,1])put(x+s*w*.36,.28,z,.12,.56,.12,'#525e5c');
  }else if(type==='storage'){
   put(x,h*.5,z,w,h,d,'#66716d');
   for(let lev=0;lev<3;lev++)put(x,.28+lev*.6,z,.56,.35,.51,pick());
  }
 }
 const matrix=new THREE.Matrix4();const pos=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
 for(const [color,items] of batches.entries()){
  const mat=new THREE.MeshStandardMaterial({color:color,roughness:.72,metalness:color==='#aeb9b2'?.2:0});
  const mesh=new THREE.InstancedMesh(boxGeo,mat,items.length);
  for(let i=0;i<items.length;i++){
   const [x,y,z,w,h,d]=items[i];pos.set(x,y,z);s.set(w,h,d);matrix.compose(pos,q,s);mesh.setMatrixAt(i,matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();fixtureGroup.add(mesh);
 }
 $('fixtureCount').textContent=fixtures.length;
}

// === Deterministic path simulation: A* equivalent shortest path on 1m grid ===
const {simulate,validate,candidates,fromIndex}=makeSimulationEngine(layout);
let results=[];
let shopperActors=[];
function drawHeat(result){
 scene.remove(heatGroup);heatGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});heatGroup=new THREE.Group();scene.add(heatGroup);
 if(!heatEnabled||!result)return;
 const buckets=[[],[],[],[]];
 for(let i=0;i<result.visits.length;i++){
  const n=result.visits[i];if(n<3)continue;
  const b=n>24?3:n>14?2:n>8?1:0;
  buckets[b].push(i);
 }
 const cols=[0x4ad6c1,0x99d16b,0xf2bb53,0xef6950];
 for(let k=0;k<4;k++){
  const v=buckets[k];if(!v.length)continue;
  const g=new THREE.PlaneGeometry(.92,.92);
  const m=new THREE.MeshBasicMaterial({color:cols[k],transparent:true,opacity:.17+k*.13,depthWrite:false,side:THREE.DoubleSide});
  const mesh=new THREE.InstancedMesh(g,m,v.length);
  const mat=new THREE.Matrix4(),pos=new THREE.Vector3(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),sc=new THREE.Vector3(1,1,1);
  v.forEach((id,n)=>{const {x,z}=fromIndex(id);pos.set(x,.09,z);mat.compose(pos,q,sc);mesh.setMatrixAt(n,mat)});mesh.instanceMatrix.needsUpdate=true;heatGroup.add(mesh);
 }
}
function makeShoppers(result){
 scene.remove(customerGroup);customerGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});
 customerGroup=new THREE.Group();scene.add(customerGroup);shopperActors=[];
 if(!result)return;
 const palette=[0x78c0b6,0xf1c08b,0xc5a8e0,0xaad18c,0xb0c7e5,0xe3a19a];
 for(let i=0;i<24;i++){
  const actor=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.32,.33,.85,8),new THREE.MeshStandardMaterial({color:palette[i%palette.length]}));body.position.y=.73;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.24,9,7),new THREE.MeshStandardMaterial({color:0xd8bc9f}));head.position.y=1.33;actor.add(body,head);
  customerGroup.add(actor);shopperActors.push({mesh:actor,route:result.paths[i*2]||[],offset:(i*11)%100});
 }
 positionShoppers();
}
function positionShoppers(){
 for(const a of shopperActors){
  const route=a.route;if(!route.length)continue;
  const progress=((clockValue+a.offset)%100)/100;
  const p=progress*(route.length-1),n=Math.floor(p),b=Math.min(route.length-1,n+1),t=p-n;
  const x=fromIndex(route[n]).x*(1-t)+fromIndex(route[b]).x*t;
  const z=fromIndex(route[n]).z*(1-t)+fromIndex(route[b]).z*t;
  a.mesh.position.set(x,.06,z);a.mesh.rotation.y=Math.atan2(fromIndex(route[b]).x-fromIndex(route[n]).x,fromIndex(route[b]).z-fromIndex(route[n]).z);
 }
}
function fmt(v){return Number(v).toFixed(1)}
function selectCandidate(id){
 const c=results.find(c=>c.id===id);if(!c||!c.ok)return;
 activePlan=id;activeFixtures=c.fixtures;simulated=c.sim;
 buildFixtureVisual(activeFixtures);drawHeat(simulated);makeShoppers(simulated);
 for(const e of document.querySelectorAll('.candidate'))e.classList.toggle('active',e.dataset.id===id);
 $('approve').disabled=id==='base';$('approve').textContent=id==='base'?'选择一个调改方案':'批准 '+c.title+'（模拟）';
 $('renderStatus').textContent='当前：'+c.title+' · '+activeFixtures.length+' 个经营对象';
}
function renderCandidates(){
 const root=$('candidates');root.innerHTML='';
 const base=results[0].sim;const preferred=results.filter(r=>r.ok).reduce((best,r)=>r.score<best.score?r:best,results[0]);
 for(const r of results){
  const el=document.createElement('button');el.className='candidate';el.dataset.id=r.id;el.disabled=!r.ok;
  el.innerHTML=`<div class="t"><b>${r.title}</b>${r.id===preferred.id?'<em>当前综合最优</em>':''}</div><small>${r.desc}</small><small>${r.ok?`平均路径 ${fmt(r.sim.avgDist)}m (${r.id==='base'?'基准':`${fmt(r.sim.avgDist-base.avgDist)}m`}) · 热点代理指标 ${fmt(r.sim.congestion)} · 陈列节数 ${r.fixtures.length}`:r.why}</small>`;
  el.onclick=()=>selectCandidate(r.id);root.appendChild(el);
 }
}
function parseGoalLocal(goal){
 const crowd=/拥堵|排队|人流|通道|高峰/.test(goal);
 const path=/路径|动线|绕路|行走|购物/.test(goal);
 const display=/陈列|销售|货架|SKU|商品/.test(goal);
 return {mode:'local',walkingWeight:path?1.1:1,congestionWeight:crowd?.72:.27,displayLossPenalty:display?7:4,reason:'本地规则解释目标'};
}
async function interpretGoal(goal){
 const fallback=parseGoalLocal(goal);
 try {const r=await fetch('/api/agent/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal})});
   if(!r.ok)return fallback;
   const val=await r.json();
   return {mode:val.mode||'local',walkingWeight:Math.max(.2,Math.min(3,Number(val.walkingWeight)||fallback.walkingWeight)),congestionWeight:Math.max(.1,Math.min(2,Number(val.congestionWeight)||fallback.congestionWeight)),displayLossPenalty:Math.max(1,Math.min(20,Number(val.displayLossPenalty)||fallback.displayLossPenalty)),reason:val.reason||''};
 }catch{return fallback;}
}
async function runAgent(){
 const goal=$('goal').value.trim();if(!goal){$('agentInfo').textContent='请先输入门店调改目标。';return;}
 $('runAgent').disabled=true;$('agentInfo').textContent='正在解析经营目标、检查布局、进行顾客路径配对模拟…';
 const weights=await interpretGoal(goal);
 window.setTimeout(()=>{
  try{
   results=candidates().map(c=>{
    const v=validate(c.fixtures),sim=v.ok?simulate(c.fixtures):null;
    const loss=layout.fixtures.length-c.fixtures.length;
    const ok=v.ok&&sim.miss===0;
    return {...c,ok,why:!v.ok?v.why:'有购物路径不可达',sim,score:ok?sim.avgDist*weights.walkingWeight+sim.congestion*weights.congestionWeight+loss*weights.displayLossPenalty:Infinity};
   });
   renderCandidates();selectCandidate('base');
   const valid=results.filter(r=>r.ok);const best=valid.reduce((b,r)=>r.score<b.score?r:b,valid[0]);
   $('agentInfo').textContent=`${weights.mode==='llm'?'已由配置的 LLM 解析目标':'使用本地规则解释目标'} → 调用布局校验、顾客路径仿真、指标评估与方案排序。${valid.length} 个合法方案，当前评分最优：${best.title}。权重：步行 ${weights.walkingWeight} / 拥堵 ${weights.congestionWeight} / 陈列损失 ${weights.displayLossPenalty}。非真实销售预测。`;
  }catch(err){$('agentInfo').textContent='仿真出错：'+err.message;console.error(err)}finally{$('runAgent').disabled=false}
 },60);
}

// Raycasting only hits semantic zone rectangles, not decorative geometry.
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
renderer.domElement.addEventListener('click',ev=>{
 const r=renderer.domElement.getBoundingClientRect();mouse.x=((ev.clientX-r.left)/r.width)*2-1;mouse.y=-((ev.clientY-r.top)/r.height)*2+1;
 raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(selectMeshes,false)[0];
 if(!hit)return;const z=Z[hit.object.userData.zoneId];
 const count=activeFixtures.filter(f=>f.zoneId===z.id).length;
 $('ttTitle').textContent=z.name;$('ttBody').textContent=`模拟区域位置 (${fmt(z.x)}, ${fmt(z.z)}) · 对象 ${count} 个。区域边界与位置根据公开手绘草图重建，并非真实施工尺寸。`;
 $('tooltip').style.display='block';
});
$('runAgent').onclick=runAgent;
$('approve').onclick=()=>{
 const c=results.find(r=>r.id===activePlan);if(!c||activePlan==='base')return;
 $('agentInfo').textContent=`模拟审批已记录：${c.title}。只作用于当前浏览器演示，没有修改真实门店或企业系统。`;
 $('approve').textContent='✓ 已在模拟环境批准';$('approve').disabled=true;
};
$('reset').onclick=()=>resetCamera(false);
$('view3d').onclick=()=>switchView('3d');$('viewTop').onclick=()=>switchView('top');$('viewPlan').onclick=()=>switchView('plan');
$('viewHeat').onclick=()=>{heatEnabled=!heatEnabled;$('viewHeat').classList.toggle('active',heatEnabled);drawHeat(simulated)};
function switchView(mode){
 activeView=mode;for(const key of ['view3d','viewTop','viewPlan'])$(key).classList.toggle('active',$(key).id===({'3d':'view3d',top:'viewTop',plan:'viewPlan'}[mode]));
 $('mapView').style.display=mode==='plan'?'flex':'none';
 if(mode==='top')resetCamera(true);else if(mode==='3d')resetCamera(false);
}
$('timeline').oninput=e=>{clockValue=Number(e.target.value);$('timeText').textContent=clockValue+'%';positionShoppers();shouldPlay=false};
function resize(){
 const w=Math.max(10,mount.clientWidth),h=Math.max(10,mount.clientHeight);renderer.setSize(w,h,false);
 const f=77;camera.left=-f*w/h/2;camera.right=f*w/h/2;camera.top=f/2;camera.bottom=-f/2;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);resize();
let last=performance.now();
function tick(now){
 const delta=Math.min(.05,(now-last)/1000);last=now;
 if(shouldPlay&&simulated){clockValue=(clockValue+delta*1.15)%100;$('timeline').value=clockValue;$('timeText').textContent=Math.round(clockValue)+'%';positionShoppers();}
 controls.update();renderer.render(scene,camera);requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
buildFixtureVisual(layout.fixtures);
$('renderStatus').textContent=`Three.js 场景就绪 · ${layout.fixtures.length} 个对象`;
// Run once: candidate metrics are genuinely computed from the same synthetic shopping baskets.
runAgent();
