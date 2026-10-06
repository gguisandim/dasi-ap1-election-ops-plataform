import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { defineConfig, devices } from "@playwright/test";

const rootEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) loadEnvFile(rootEnv);

export default defineConfig({
  testDir: "./tests/e2e",
  // Os fluxos cross-domain falam com um banco remoto atrás de pooler, com pool
  // de conexões limitado: a sequência completa de um fluxo leva mais do que o
  // padrão de 90s. Testes individuais podem elevar o próprio teto.
  timeout: 150_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
      },
    },
  ],
  webServer: [
    {
      command: "npm run start:prod -w @eops/api",
      env: {
        JWT_SECRET:
          process.env.JWT_SECRET ??
          "e2e-only-secret-with-at-least-24-characters",
        PORT: "3001",
      },
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run preview -w @eops/web -- --host 127.0.0.1",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
