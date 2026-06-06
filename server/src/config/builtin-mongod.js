import { createConnection } from "net";
import { spawn, spawnSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "fs";
import path from "path";

let mongodProcess = null;
let activePort = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isCorruptionError(err) {
  const msg = String(err?.message || err);
  return (
    /fassert/i.test(msg) ||
    /WiredTiger/i.test(msg) ||
    /corrupt/i.test(msg) ||
    /lock/i.test(msg) ||
    /NonExistent/i.test(msg)
  );
}

export function removeStaleLocks(dbPath) {
  for (const name of ["mongod.lock", "WiredTiger.lock"]) {
    const file = path.join(dbPath, name);
    if (existsSync(file)) {
      try {
        rmSync(file, { force: true });
        console.warn(`Removed stale lock: ${name}`);
      } catch {
        /* ignore */
      }
    }
  }
}

export function shopDataLooksEmpty(dbPath) {
  if (!existsSync(dbPath)) return true;
  let names;
  try {
    names = readdirSync(dbPath);
  } catch {
    return true;
  }
  const meaningful = names.filter(
    (n) => !["mongod.lock", "WiredTiger.lock", ".server.pid"].includes(n),
  );
  return meaningful.length === 0;
}

export function runMongodRepair(binary, dbPath) {
  console.warn("Running mongod --repair (please wait, can take several minutes)…");
  const result = spawnSync(binary, ["--dbpath", dbPath, "--repair"], {
    stdio: "inherit",
    windowsHide: true,
    timeout: 600000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`mongod --repair exited with code ${result.status}`);
  }
  removeStaleLocks(dbPath);
}

export function quarantineBrokenDb(dbPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `${dbPath}.broken-${stamp}`;
  renameSync(dbPath, backup);
  mkdirSync(dbPath, { recursive: true });
  console.warn(`Moved broken database folder to:\n  ${backup}`);
  return backup;
}

function waitForPort(port, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      const socket = createConnection({ port, host: "127.0.0.1" });
      socket.setTimeout(2000);
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`MongoDB did not open port ${port} within ${Math.round(timeoutMs / 1000)}s`));
          return;
        }
        setTimeout(attempt, 750);
      });
      socket.once("timeout", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`MongoDB did not open port ${port} within ${Math.round(timeoutMs / 1000)}s`));
          return;
        }
        setTimeout(attempt, 750);
      });
    };
    attempt();
  });
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function pickPort(preferred) {
  const candidates = [preferred, 27018, 27019, 27020];
  for (const port of candidates) {
    if (!(await portInUse(port))) return port;
  }
  throw new Error(`All MongoDB ports busy (${candidates.join(", ")})`);
}

function spawnMongod(binary, dbPath, port) {
  const args = [
    "--dbpath",
    dbPath,
    "--port",
    String(port),
    "--bind_ip",
    "127.0.0.1",
    "--storageEngine",
    "wiredTiger",
  ];

  const child = spawn(binary, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: false,
  });

  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    if (/error|fassert|assertion/i.test(text)) {
      console.error(`[mongod] ${text.trim()}`);
    }
  });
  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    if (text.trim()) console.error(`[mongod] ${text.trim()}`);
  });

  child.on("error", (err) => {
    console.error("mongod process error:", err.message);
  });

  return child;
}

/**
 * Start bundled/system mongod directly (more reliable than MongoMemoryServer on shop PCs).
 */
export async function startDirectMongod({ binary, dbPath, port = 27017 }) {
  if (mongodProcess) {
    return { uri: `mongodb://127.0.0.1:${activePort}/bappistores`, port: activePort };
  }

  mkdirSync(dbPath, { recursive: true });
  removeStaleLocks(dbPath);

  const chosenPort = await pickPort(Number(process.env.BUILTIN_MONGOD_PORT) || port);
  console.log(`Starting built-in database (direct mongod on port ${chosenPort})…`);

  mongodProcess = spawnMongod(binary, dbPath, chosenPort);
  activePort = chosenPort;

  const crashed = new Promise((_, reject) => {
    mongodProcess.once("exit", (code, signal) => {
      mongodProcess = null;
      activePort = null;
      reject(
        new Error(
          `mongod exited unexpectedly (code ${code ?? "?"}, signal ${signal ?? "?"})`,
        ),
      );
    });
  });

  try {
    await Promise.race([waitForPort(chosenPort), crashed]);
  } catch (err) {
    try {
      mongodProcess?.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    mongodProcess = null;
    activePort = null;
    throw err;
  }

  await sleep(500);
  return { uri: `mongodb://127.0.0.1:${chosenPort}/bappistores`, port: chosenPort };
}

export async function stopDirectMongod() {
  if (!mongodProcess) return;
  const proc = mongodProcess;
  mongodProcess = null;
  activePort = null;
  try {
    proc.kill("SIGTERM");
    await sleep(1500);
    if (!proc.killed) proc.kill("SIGKILL");
  } catch {
    /* ignore */
  }
}

export function verifyMongodBinary(binary) {
  const result = spawnSync(binary, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `mongod --version failed (exit ${result.status}). Antivirus may have blocked ${binary}`,
    );
  }
  return (result.stdout || result.stderr || "").trim().split("\n")[0];
}
