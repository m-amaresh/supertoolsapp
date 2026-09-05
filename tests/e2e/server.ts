import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const READY_TIMEOUT_MS = 60_000;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Could not determine a free port"));
        return;
      }
      probe.close(() => resolve(address.port));
    });
  });
}

async function waitForReady(baseUrl: string, child: ChildProcess) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not become ready within ${READY_TIMEOUT_MS}ms`);
}

export interface RunningServer {
  baseUrl: string;
  stop: () => Promise<void>;
}

/**
 * Serve the existing production build. Layout defects like toolbar clipping are
 * a property of the built CSS, so these tests must never run against `next dev`.
 */
export async function startProductionServer(): Promise<RunningServer> {
  if (!existsSync(join(ROOT, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found. Run `pnpm build` before `pnpm test:e2e`.",
    );
  }

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(
    process.execPath,
    [
      join(ROOT, "node_modules/next/dist/bin/next"),
      "start",
      "--port",
      String(port),
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: process.env },
  );

  let log = "";
  child.stdout?.on("data", (chunk) => {
    log += chunk;
  });
  child.stderr?.on("data", (chunk) => {
    log += chunk;
  });

  try {
    await waitForReady(baseUrl, child);
  } catch (error) {
    child.kill("SIGKILL");
    throw new Error(
      `${(error as Error).message}\n--- next start output ---\n${log}`,
    );
  }

  return {
    baseUrl,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
      }),
  };
}
