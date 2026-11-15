import { defineConfig } from '@playwright/test';

/**
 * YH 工作台白膜演示的端到端冒烟测试（独立配置，不影响既有 live/demo/a11y 项目）。
 * 覆盖演示主线：场景渲染 → 告警 → 本地规则助手 → 三方案对比 → 送审 → 店长批准 →
 * 刷新后留痕 → 回滚 → 事件注入数据隔离。无头 Chromium 用软件 GL 渲染 WebGL。
 * 运行：npx playwright test -c playwright.yh.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /yh-workbench\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: 'experiments/results/yh-e2e-artifacts',
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    launchOptions: { args: ['--disable-gpu', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node node_modules/tsx/dist/cli.mjs apps/api/src/main.ts',
      url: 'http://127.0.0.1:8077/api/health',
      timeout: 60_000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run web',
      url: 'http://localhost:5174/',
      timeout: 90_000,
      reuseExistingServer: true,
    },
  ],
  projects: [{ name: 'yh-chromium', use: { browserName: 'chromium', channel: 'chrome' } }],
});
