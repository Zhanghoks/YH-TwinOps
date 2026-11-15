import { expect, test } from '@playwright/test';

/**
 * YH 工作台白膜全链路（对应 spec 的演示故事线，AT-01/05/06/07 的 UI 冒烟版）：
 * 全店状态 → 异常告警 → Agent 诊断（约束拒绝也如实回答）→ 三方案同种子仿真 →
 * 送审 → 店长亲自批准 → 刷新后留痕 → 回滚 → 事件注入只更新对应分区。
 * 全程断言用户可见状态，不碰 canvas 内部；截图存 experiments/results/yh-whitebox/。
 */

const SHOT = 'experiments/results/yh-whitebox';

test('白膜工作台全链路：告警 → 助手 → 三方案 → 审批留痕 → 注入隔离', async ({ page }) => {
  // 1. 场景渲染：单一 3D canvas + 分区标签（drei Html）+ 诚信标注
  await page.goto('/');
  await expect(page.getByText('YH-TwinOps 全店运营工作台')).toBeVisible();
  await expect(page.getByText(/合成教学演示 · 非永辉官方系统 · 无真实数据/)).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.zone-label').filter({ hasText: 'checkout_n' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.zone-label').filter({ hasText: '队列 16 人' })).toBeVisible();
  await page.screenshot({ path: `${SHOT}/01-scene.png` });

  // 2. 告警中心：收银队列 CRITICAL 来自规则阈值，带证据 ID
  await expect(page.locator('.alert-card').filter({ hasText: 'CRITICAL' })).toBeVisible();
  await expect(page.getByText(/队列长度 16 达到 CRITICAL 阈值/)).toBeVisible();
  await expect(page.locator('.alert-card code').first()).toContainText('syn-');
  await page.screenshot({ path: `${SHOT}/02-alerts.png` });

  // 3. 门店助手（本地规则、离线）：调 3 人被约束拒绝；调 1 人给出预测与成本
  await page.getByRole('button', { name: '门店助手' }).click();
  await page.getByRole('button', { name: /调 3 人支援收银行不行/ }).click();
  await expect(page.getByText(/无法执行/)).toBeVisible();
  await expect(page.getByText(/岗位资格/)).toBeVisible();
  await expect(page.getByText(/持收银资格的在岗人数 1/)).toBeVisible();
  await page.locator('.agent-input').fill('调 1 人支援收银可以吗？');
  await page.getByRole('button', { name: '提问', exact: true }).click();
  await expect(page.getByText(/预测平均等待/)).toBeVisible();
  await expect(page.getByText(/成本约 12\.5 元/)).toBeVisible();
  await expect(page.getByText(/合成教学时薪假设/)).toBeVisible();
  await page.screenshot({ path: `${SHOT}/03-agent.png` });

  // 4. 方案对比：同种子三方案；C 带成本，A/B 成本如实留空
  await page.getByRole('button', { name: '方案对比' }).click();
  await expect(page.getByText('A 保持现状')).toBeVisible();
  await expect(page.getByText('B 增开 1 条通道')).toBeVisible();
  await expect(page.getByText('C 调 1 人支援收银')).toBeVisible();
  const cardC = page.locator('.scenario-card').filter({ hasText: 'C 调 1 人支援收银' });
  await expect(cardC.getByText(/成本：12\.5 元/)).toBeVisible();
  await expect(page.getByText(/模拟情景/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT}/04-compare.png` });

  // 5. 送店长审批 → 自动切到审批页并出现 PENDING 记录（切换后源面板消息随之卸载）
  await cardC.getByRole('button', { name: '送店长审批' }).click();
  const approvalCard = page.locator('.approval-card');
  await expect(approvalCard).toBeVisible();
  await expect(page.getByText('待店长决策')).toBeVisible();
  await expect(approvalCard.getByText(/快照 snap-/)).toBeVisible();

  // 6. 店长亲自批准 → 模拟任务单生成
  await page.getByRole('button', { name: '批准（店长）' }).click();
  await expect(page.getByText('已批准')).toBeVisible();
  await expect(page.getByText(/模拟任务单/)).toBeVisible();
  await page.screenshot({ path: `${SHOT}/05-approved.png` });

  // 7. 刷新后审批记录仍在（后端文件持久化，US-41）
  await page.reload();
  await page.getByRole('button', { name: '审批' }).click();
  await expect(page.getByText('已批准')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/已连接审批沙盒 API/)).toBeVisible();

  // 8. 回滚本次批准（留痕：rolledBackAt）
  await page.getByRole('button', { name: '回滚本次批准' }).click();
  await expect(page.getByText(/已回滚/)).toBeVisible();
  await page.screenshot({ path: `${SHOT}/06-rollback.png` });

  // 9. 事件注入数据隔离（US-30）：蔬果区补采后，客流图层该区从「无数据」变 176 人
  await page.getByRole('button', { name: /注入蔬果区客流补采/ }).click();
  await page.getByRole('button', { name: '客流', exact: true }).click();
  const produceLabel = page.locator('.zone-label').filter({ hasText: 'produce' });
  await expect(produceLabel).toContainText('客流 176 人');
  await page.screenshot({ path: `${SHOT}/07-injected.png` });
});
