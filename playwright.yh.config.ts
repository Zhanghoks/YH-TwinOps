import { defineConfig } from '@playwright/test';

const baseURL = process.env.YH_E2E_BASE_URL ?? 'http://localhost:5174';
const localStack = process.env.YH_E2E_BASE_URL === undefined;
const ruleApi = "import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path'; import { buildApp } from './apps/api/src/main.ts'; await buildApp({dataDir:mkdtempSync(join(tmpdir(),'yh-e2e-')),env:{}});";

/**
 * YH 工作台白膜演示的端到端冒烟测试（独立配置，不影响既有 live/demo/a11y 项目）。
 * 覆盖演示主线：场景渲染 → 告警 → 本地规则助手 → 三方案对比 → 送审 → 店长批准 →
 * 刷新后留痕 → 回滚 → 事件注入数据隔离。无头 Chromium 用软件 GL 渲染 WebGL。
 * 运行：npx playwright test -c playwright.yh.config.ts
 * 可用 YH_E2E_BASE_URL 指向明确的测试部署；纯静态站使用
 * YH_E2E_SKIP_API=1，仅运行浏览器离线规则用例。
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /yh-(?:workbench|product-to-twin)\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: 'experiments/results/yh-e2e-artifacts',
  use: {
    baseURL,
    viewport: { width: 1440, height: 1080 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    launchOptions: { args: ['--disable-gpu', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
  },
  webServer: localStack ? [
    {
      command: `node --import tsx --input-type=module -e "${ruleApi}"`,
      url: 'http://127.0.0.1:8077/api/health',
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run web',
      url: 'http://localhost:5174/',
      timeout: 90_000,
      reuseExistingServer: false,
    },
  ] : undefined,
  projects: [{ name: 'yh-chromium', use: {
    browserName: 'chromium', ...(process.env.PW_CHANNEL === '' ? {} : { channel: process.env.PW_CHANNEL ?? 'chrome' }),
  } }],
});
