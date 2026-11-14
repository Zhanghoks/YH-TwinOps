import { expect, test } from '@playwright/test';

// 冒烟范围（spec 的唯一新增缝隙）：真实浏览器里
// 页面加载 → 3D 就绪 → Agent 生成 3 个合法方案 → 方案切换联动 → 热力图视图生效。
// 只断言用户可见状态（DOM 文案 / 按钮 / 状态栏），不检查 canvas 内部实现。
test('大型门店孪生：加载 → 3D 就绪 → Agent 出 3 方案 → 方案切换 → 热力图', async ({ page }) => {
  await page.goto('/index.local.html');

  // 3D 场景就绪（150 个陈列对象完成加载）
  await expect(page.getByText('Three.js 场景就绪')).toBeVisible({ timeout: 30_000 });

  // 页面加载时会自动跑一轮 Agent 主循环；等它结束、按钮恢复可用
  const run = page.getByRole('button', { name: '✦ 生成并仿真 3 个布局方案' });
  await expect(run).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByText(/3 个合法方案/)).toBeVisible();

  // 手动再跑一轮，确认主循环可重复、结果确定
  await run.click();
  await expect(page.getByRole('button', { name: /方案 A · 原始分区/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /方案 B · 增设跨区通道/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /方案 C · 生鲜岛台错位/ })).toBeVisible();

  // 切换综合最优方案 C：底部状态栏与模拟审批按钮联动
  await page.getByRole('button', { name: /方案 C · 生鲜岛台错位/ }).click();
  await expect(page.getByText('当前：方案 C · 生鲜岛台错位 · 150 个经营对象')).toBeVisible();
  await expect(page.getByRole('button', { name: /批准 方案 C/ })).toBeVisible();

  // 热力图视图生效（按钮进入激活态）
  await page.getByRole('button', { name: '热力图' }).click();
  await expect(page.getByRole('button', { name: '热力图' })).toHaveClass(/active/);
});
