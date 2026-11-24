import { defineConfig } from "@playwright/test";

const port = process.env.SHIFTCHESS_TEST_PORT ?? "48647";
const url = "http://127.0.0.1:" + port;
const serverPort = process.env.SHIFTCHESS_TEST_SERVER_PORT ?? "48657";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: url,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    reducedMotion: "reduce",
  },
  webServer: [
    {
      command:
        "npm run dev -- --host 127.0.0.1 --port " + port + " --strictPort",
      url,
      env: { VITE_SERVER_URL: "ws://127.0.0.1:" + serverPort + "/socket" },
    },
    {
      command: "npm run server",
      url: "http://127.0.0.1:" + serverPort + "/health",
      env: { PORT: serverPort, HOST: "127.0.0.1", DATABASE_PATH: ":memory:" },
    },
  ],
});
