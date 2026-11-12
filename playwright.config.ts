import { defineConfig } from '@playwright/test';

const port = process.env.SHIFTCHESS_TEST_PORT ?? '48647';
const url = 'http://127.0.0.1:' + port;

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  timeout: 45000,
  use: {
    baseURL: url,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions: { args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] },
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port ' + port + ' --strictPort',
    url,
    reuseExistingServer: true,
  },
});
