import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const SKU = 'YH-LOCAL-E2E-001';
const TEMPLATE = 'YH-DEMO-002';
const SAME_MODEL = {sku:'YH-LOCAL-E2E-002',template:'YH-DEMO-004',name:'同模板异 SKU 教学纸盒'};
const COLD_SKU = 'YH-DEMO-015';
const FIXED_TIME = new Date('2026-11-20T06:30:00.000Z');
const QUESTION = `F077 有什么商品？ ${SKU} 库存有多少？`;

const catalog = (page:Page) => page.getByRole('radio', {name:'商品目录', exact:true});
const twin = (page:Page) => page.getByRole('radio', {name:'3D 孪生', exact:true});
const trial = (page:Page) => page.getByRole('region', {name:'试摆到货位'});
const skuSearch = (page:Page) => page.getByRole('searchbox', {name:'搜索商品'});
const chooser = (panel:Locator) => panel.getByLabel('选择 F077 货位');
const preview = (panel:Locator) => panel.getByRole('button', {name:'预览试摆', exact:true});
const apply = (panel:Locator) => panel.getByRole('button', {name:'应用到本机模拟场景', exact:true});
const revert = (panel:Locator) => panel.getByRole('button', {name:'撤回单格试摆', exact:true});

async function open(page:Page) {
  await page.clock.setFixedTime(FIXED_TIME);
  await page.goto('/');
  await expect(page.getByText('合成教学演示 · 非永辉官方系统 · 无真实数据')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.zone-label').first()).toBeVisible({timeout:30_000});
  await expect.poll(() => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBeGreaterThan(300);
  const buffer = await page.locator('canvas').evaluate(canvas => {
    const gl=(canvas as HTMLCanvasElement).getContext('webgl2');
    return gl&&!gl.isContextLost() ? {width:gl.drawingBufferWidth,height:gl.drawingBufferHeight} : null;
  });
  expect(buffer?.width).toBeGreaterThan(300);
  expect(buffer?.height).toBeGreaterThan(300);
  console.log('Actual WebGL2 drawing buffer', buffer);
}

async function selectSku(page:Page, sku:string) {
  await skuSearch(page).fill(sku);
  await expect(page.locator('.pc-intro .pc-kicker')).toHaveText(sku);
}

async function addLocalProduct(page:Page, product={sku:SKU,template:TEMPLATE,name:'教学试摆罐装商品'}) {
  await catalog(page).click();
  await expect(page.getByText(/16 种原创示意商品.*596 个试换陈列位置/)).toBeVisible();
  await page.getByRole('button', {name:'新增商品', exact:true}).click();
  const form = page.getByRole('form', {name:'新增商品表单'});
  await form.getByLabel('3D 模型模板').selectOption(product.template);
  await form.getByLabel('商品 SKU').fill(product.sku);
  await form.getByLabel('商品名称').fill(product.name);
  await form.getByLabel('商品规格').fill('独立 SKU · 教学样本');
  await form.getByLabel('商品介绍（可选）').fill('用于验证目录、货位与库存的单格测试示意商品。');
  await form.getByRole('button', {name:'保存商品'}).click();
  await expect(page.getByRole('heading', {name:product.name})).toBeVisible();
  await expect(page.locator('.pc-model-surface svg path').first()).toBeAttached();
  await expect(trial(page)).not.toContainText(product.sku + '（教学沙盒）');
  return trial(page);
}

async function previewCompatibleSlot(panel:Locator) {
  const select = chooser(panel);
  await expect(select).toBeEnabled();
  const real = await select.locator('option').evaluateAll((options, template) => options
    .map(o => ({id:(o as HTMLOptionElement).value,label:o.textContent??''}))
    .filter(o => o.id && !o.label.includes(template)), TEMPLATE);
  // Prefer a camera-facing carton slot for a visually distinct can substitution.
  real.sort((a,b) => Number(b.label.includes('正面')&&b.label.includes('YH-DEMO-004'))
    - Number(a.label.includes('正面')&&a.label.includes('YH-DEMO-004')));
  for(const entry of real.slice(0,12)) {
    await select.selectOption(entry.id);
    await preview(panel).click();
    if (await apply(panel).isEnabled()) {
      await expect(panel.getByText('试摆校验通过')).toBeVisible();
      await expect(panel.getByText(/原陈列：YH-DEMO-/)).toBeVisible();
      await expect(panel.getByText(`目标 SKU：${SKU}`, {exact:false})).toBeVisible();
      return entry.id;
    }
  }
  throw new Error('No compatible camera-facing F077 slot among representative real slots');
}

async function focusSeedFixture(page:Page) {
  await twin(page).click();
  const settings = page.locator('summary').filter({hasText:'场景设置'});
  await settings.click();
  await page.getByRole('button', {name:'试换 F077 食品', exact:true}).click();
  if (await settings.locator('..').getAttribute('open')!==null) await settings.click();
  await expect(page.locator('canvas')).toBeVisible();
}

async function canvasShot(page:Page, info:TestInfo, stem:string) {
  // The camera eases to its fixture preset asynchronously; wait only for the
  // screenshot after already checking the visible state. This is capture,
  // not a correctness assertion about picking or camera internals.
  await page.waitForTimeout(2200);
  const path = info.outputPath(stem+'.jpg');
  await page.screenshot({path, type:'jpeg', quality:82, animations:'disabled'});
  await info.attach(stem,{path, contentType:'image/jpeg'});
}

async function expectFixtureSku(page:Page, slotId:string, sku=SKU) {
  const summary = page.locator('summary').filter({hasText:/场景与数据/});
  if (await summary.locator('..').getAttribute('open')===null) await summary.click();
  const detail = page.getByRole('region',{name:'设施陈列与库存'});
  await expect(summary.locator('..')).toContainText('设施 F077');
  await detail.getByLabel('查看货位').selectOption(slotId);
  await expect(detail.getByLabel('查看货位')).toHaveValue(slotId);
  await expect(detail.locator('code')).toHaveText(sku);
  return detail;
}

async function ask(page:Page, question=QUESTION, expected:string|RegExp=SKU) {
  const summary = page.locator('summary').filter({hasText:/场景与数据/});
  if (await summary.locator('..').getAttribute('open')!==null) await summary.click();
  const response = page.getByRole('article',{name:'助手回答'}).last();
  const before = await page.getByRole('article',{name:'助手回答'}).count();
  await page.getByPlaceholder(/问问门店现状/).fill(question);
  await page.getByRole('button',{name:'提问',exact:true}).click();
  await expect(page.getByRole('article',{name:'助手回答'})).toHaveCount(before+1);
  await expect(response.locator('.answer-text')).toContainText(expected);
  return response;
}

test('Product-to-Twin offline: add → reject bad fit → preview real F077 slot → place → honest stock → rollback', async ({page}, info) => {
  const pageErrors:string[]=[];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/api/**', route => route.abort('internetdisconnected'));
  await open(page);
  const panel = await addLocalProduct(page);
  const slotId = await previewCompatibleSlot(panel);
  await expect(revert(panel)).toBeDisabled(); // a preview never applies

  // The same real slot must not accept a chilled product on the ambient rack.
  await selectSku(page,COLD_SKU);
  await chooser(panel).selectOption(slotId);
  await preview(panel).click();
  await expect(panel.getByText('无法试摆，原陈列保留')).toBeVisible();
  await expect(apply(panel)).toBeDisabled();

  await focusSeedFixture(page);
  await canvasShot(page,info,'f077-before');
  console.log('Captured actual before screenshot for F077 slot',slotId);
  await catalog(page).click();
  await selectSku(page,SKU);
  await chooser(panel).selectOption(slotId);
  await preview(panel).click();
  await expect(panel.getByText('试摆校验通过')).toBeVisible();
  console.log('Approved preview for screenshot',slotId,await panel.getByText(/原陈列：YH-DEMO-/).innerText(),SKU);
  await apply(panel).click();
  await expect(twin(page)).toBeChecked();
  await expect(page.locator('canvas')).toHaveCount(1);
  const detail = await expectFixtureSku(page,slotId);
  await expect(detail).toContainText('UNKNOWN');
  await canvasShot(page,info,'f077-after');
  console.log('Captured actual after screenshot for F077 slot',slotId);
  const unknown = await ask(page);
  await expect(unknown.locator('.answer-text')).toContainText('UNKNOWN');
  await expect(unknown.locator('.answer-text')).toContainText(slotId);
  await expect(unknown.locator('.answer-text')).toContainText('USER_SANDBOX');
  await expect(unknown.locator('.answer-text')).toContainText('陈列位置数不是库存');
  await unknown.getByRole('button',{name:'展开证据与工具轨迹'}).click();
  await expect(unknown.getByText('get_fixture_products',{exact:true})).toBeVisible();
  await expect(unknown.getByText('get_sku_inventory',{exact:true})).toBeVisible();
  await expect(page.getByText(/浏览器本地规则（离线）/).first()).toBeVisible();

  await catalog(page).click();
  await selectSku(page,SKU);
  await expect(panel.getByText(`当前试摆：${slotId} · ${SKU}`,{exact:false})).toBeVisible();
  await twin(page).click();
  await (await expectFixtureSku(page,slotId)).getByRole('button',{name:'注入合成库存观测'}).click();
  const observed = await ask(page,`F077 的 ${SKU} 库存有多少？`,/合成观测/);
  const answer = await observed.locator('.answer-text').innerText();
  expect(answer).not.toContain('UNKNOWN');
  expect(answer).toContain('synthetic-stock-fixture');
  const reading = answer.match(/\d+\s*件/)?.[0];
  expect(reading).toBeTruthy();
  await expect(detail).toContainText(reading!);

  // Entity and layout identity must survive navigating away and back.
  await page.getByRole('radio',{name:'经营看板',exact:true}).click();
  await twin(page).click();
  await expectFixtureSku(page,slotId);
  await page.reload();
  await catalog(page).click();
  await selectSku(page,SKU);
  await expect(panel.getByText(`当前试摆：${slotId} · ${SKU}`,{exact:false})).toBeVisible();
  await revert(panel).click();
  await expect(revert(panel)).toBeDisabled();
  await expect(page.getByText(/596 个试换陈列位置/)).toBeVisible();
  await twin(page).click();
  const rolledBack=await ask(page,'F077 有什么商品？','陈列位置数不是库存');
  await expect(rolledBack.locator('.answer-text')).not.toContainText(SKU);

  // A new SKU with the SAME inherited geometry is still a separate business identity.
  await addLocalProduct(page,SAME_MODEL);
  const sharedTemplateSlot = await chooser(panel).locator('option').evaluateAll((options, template) =>
    (options.find(o => (o.textContent??'').includes('正面')&&(o.textContent??'').includes(template))
      ?? options.find(o => (o.textContent??'').includes(template)))?.getAttribute('value'),SAME_MODEL.template);
  expect(sharedTemplateSlot).toBeTruthy();
  await chooser(panel).selectOption(sharedTemplateSlot!);
  await preview(panel).click();
  await expect(panel.getByText(/原陈列：YH-DEMO-004/)).toBeVisible();
  await expect(apply(panel)).toBeEnabled();
  await apply(panel).click();
  await expectFixtureSku(page,sharedTemplateSlot!,SAME_MODEL.sku);
  const sameModel = await ask(page,`F077 有什么商品？ ${SAME_MODEL.sku} 库存有多少？`,SAME_MODEL.sku);
  await expect(sameModel.locator('.answer-text')).toContainText(sharedTemplateSlot!);
  await expect(sameModel.locator('.answer-text')).toContainText('USER_SANDBOX');
  await catalog(page).click();
  await selectSku(page,SAME_MODEL.sku);
  await expect(panel.getByText(`当前试摆：${sharedTemplateSlot} · ${SAME_MODEL.sku}`,{exact:false})).toBeVisible();
  await revert(panel).click();
  await expect(revert(panel)).toBeDisabled();

  // The global same-SKU visualization remains mutually exclusive with
  // single-slot logic; no virtual multiplicity becomes inventory.
  await catalog(page).click();
  await selectSku(page,'YH-DEMO-004');
  const fill = page.getByRole('region',{name:'F077 同款铺满试用'});
  await fill.getByRole('button',{name:'应用到 F077 并查看'}).click();
  await catalog(page).click();
  await selectSku(page,SKU);
  await expect(panel).toContainText(/先撤回.*同款/);
  await expect(chooser(panel)).toBeDisabled();
  await selectSku(page,'YH-DEMO-004');
  await fill.getByRole('button',{name:'撤回同款铺满'}).click();
  await selectSku(page,SKU);
  await expect(chooser(panel)).toBeEnabled();

  await twin(page).click();
  await page.getByRole('button',{name:'布局检查',exact:true}).click();
  await page.getByRole('button',{name:'原型基线',exact:true}).click();
  await catalog(page).click();
  await expect(chooser(panel)).toBeDisabled();
  await expect(panel).toContainText(/密集|候选|已核验/);
  await twin(page).click();
  await page.getByRole('button',{name:'按图候选',exact:true}).click();
  await catalog(page).click();
  await expect(chooser(panel)).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test('Product-to-Twin real rules API: browser snapshot, matching fixture/stock facts, legacy request fallback',async({page})=>{
  test.skip(process.env.YH_E2E_SKIP_API==='1','Only the static frontend was provided; no API is assumed');
  const health=await page.request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ok:true,agent:'rules-local'});
  await open(page);
  const panel=await addLocalProduct(page);
  const slotId=await previewCompatibleSlot(panel);
  await apply(panel).click();
  const waitForAskResponse = () => page.waitForResponse(r => r.url().endsWith('/api/agent/ask') && r.request().method()==='POST',{timeout:20_000});
  const [first, offlineParity] = await Promise.all([waitForAskResponse(),ask(page)]);
  expect(first.status()).toBe(200);
  const firstJson:unknown=await first.json();
  expect(firstJson).toMatchObject({mode:'rules-local',answer:expect.stringContaining('UNKNOWN'),toolCalls:[
    {tool:'get_fixture_products',args:{fixtureId:'F077'}},
    {tool:'get_sku_inventory',args:{sku:SKU,fixtureId:'F077'}},
  ]});
  expect(JSON.stringify(firstJson)).toContain(slotId);
  await expect(offlineParity.locator('.answer-text')).toContainText('USER_SANDBOX');
  await expect(offlineParity.locator('.answer-text')).toContainText('UNKNOWN');

  await (await expectFixtureSku(page,slotId)).getByRole('button',{name:'注入合成库存观测'}).click();
  const [second, observed]=await Promise.all([waitForAskResponse(),ask(page,`F077 的 ${SKU} 库存有多少？`,/合成观测/)]);
  expect(second.status()).toBe(200);
  expect(await second.json()).toMatchObject({mode:'rules-local',answer:expect.stringMatching(/\d+\s*件/),evidence:expect.arrayContaining([
    expect.objectContaining({metric:'sku_inventory',synthetic:true,sourceId:'synthetic-stock-fixture'}),
  ])});
  await expect(observed.locator('.answer-text')).not.toContainText('UNKNOWN');

  // Drop the optional context entirely, as an older client would.
  const body:unknown=first.request().postDataJSON();
  expect(body).toMatchObject({merchandising:expect.any(Object)});
  if(body===null||typeof body!=='object'||Array.isArray(body))throw new Error('Unexpected browser request body');
  const {merchandising: _omitted, ...legacy}=body as Record<string,unknown>;
  const compatible=await page.request.post('/api/agent/ask',{data:legacy});
  expect(compatible.ok()).toBe(true);
  expect(await compatible.json()).toMatchObject({mode:'rules-local',answer:expect.stringContaining('UNKNOWN')});
});
