import { spawn } from "node:child_process";
import { createServer } from "vite";

console.log("🚀 Initializing KobeanREST Senior SDET E2E Automation Test Runner...");

async function runE2ESuite() {
  console.log("📦 Starting application server for E2E testing on port 4173...");
  const viteServer = await createServer({
    server: { port: 4173 }
  });
  await viteServer.listen();
  console.log("✅ App preview server running at http://localhost:4173");

  const codecept = spawn("npx", ["codeceptjs", "run", "--config", "codecept.conf.cjs", "--steps"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, CI: "true" }
  });

  codecept.on("close", (code) => {
    viteServer.close();
    if (code === 0) {
      console.log("🎉 All CodeceptJS E2E automation tests passed successfully!");
      process.exit(0);
    } else {
      console.error(`❌ CodeceptJS test suite failed with exit code ${code}`);
      process.exit(code || 1);
    }
  });
}

runE2ESuite().catch((err) => {
  console.error("Fatal E2E runner error:", err);
  process.exit(1);
});
