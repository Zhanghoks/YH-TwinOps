import { defineConfig } from '@playwright/test';

/**
 * YH-TwinOps 大型门店冒烟测试（spec 约定的唯一新增测试缝隙，
 * 见 .scratch/yh-twinops-large-store/spec.md）。
 * 复用仓库 Playwright 约定：本机用已安装的 Chrome（channel），CI 或
 * PW_SOFTWARE_GL=1 时关闭显卡加速、用软件渲染 WebGL。
 * 独立于 Storewright 的 8799/4177 服务，自己起 yh 静态服务（默认端口 8797）。
 */
const channel = process.env.PW_CHANNEL ?? 'chrome';
const softwareGl = process.env.PW_SOFTWARE_GL ? { launchOptions: { args: ['--disable-gpu', '--enable-unsafe-swiftshader'] } } : {};

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: process.env.CI ? 30_000 : 15_000 },
  workers: 1,
  reporter: 'list',
  use: {
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 large-store/server.py',
    url: 'http://127.0.0.1:8797/layout.json',
    env: { PORT: '8797' },
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'yh-large-store', use: { ...softwareGl, ...(channel ? { channel } : {}), baseURL: 'http://127.0.0.1:8797' } },
  ],
});
