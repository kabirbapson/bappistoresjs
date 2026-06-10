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
    /recovery failed/i.test(msg) ||
    /metadata corruption/i.test(msg) ||
    /WiredTigerLog/i.test(msg) ||
    /corrupt/i.test(msg) ||
    /non-specific WiredTiger/i.test(msg) ||
    /exited unexpectedly \(code 14/i.test(msg) ||
    /NonExistent/i.test(msg)
  );
}

export function warnIfRiskyDbLocation(dbPath) {
  const normalized = dbPath.replace(/\\/g, "/").toLowerCase();
  if (
    normalized.includes("/documents/") ||
    normalized.includes("onedrive") ||
    normalized.includes("/desktop/")
  ) {
    console.warn(
      "Database is under Documents, Desktop, or OneDrive — this often corrupts MongoDB.\n" +
        "Move the whole Bappi Stores folder to C:\\BappiStores and run REPAIR-DATABASE.bat.",
    );
  }
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

  const logs = { stdout: "", stderr: "" };

  const child = spawn(binary, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: false,
  });

  const noteLog = (text) => {
    if (!text.trim()) return;
    if (/fatal assertion|fassert|recovery failed|metadata corruption/i.test(text)) {
      console.error(`[mongod] ${text.trim().slice(0, 500)}`);
    }
  };

  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    logs.stdout += text;
    noteLog(text);
  });
  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    logs.stderr += text;
    noteLog(text);
  });

  child.on("error", (err) => {
    console.error("mongod process error:", err.message);
  });

  child._bappiLogs = logs;
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
  warnIfRiskyDbLocation(dbPath);
  removeStaleLocks(dbPath);

  const chosenPort = await pickPort(Number(process.env.BUILTIN_MONGOD_PORT) || port);
  console.log(`Starting built-in database (direct mongod on port ${chosenPort})…`);

  const proc = spawnMongod(binary, dbPath, chosenPort);
  mongodProcess = proc;
  activePort = chosenPort;

  const crashed = new Promise((_, reject) => {
    proc.once("exit", (code, signal) => {
      mongodProcess = null;
      activePort = null;
      const tail = `${proc._bappiLogs?.stderr || ""}${proc._bappiLogs?.stdout || ""}`.slice(-2000);
      reject(
        new Error(
          `mongod exited unexpectedly (code ${code ?? "?"}, signal ${signal ?? "?"})\n${tail}`,
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
