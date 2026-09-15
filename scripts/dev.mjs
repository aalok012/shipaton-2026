import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { isIPv4 } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const python = resolve(root, "backend/.venv/bin/python");
const expo = resolve(root, "app/node_modules/expo/bin/cli");
const children = new Set();
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  const deadline = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 4000);
  deadline.unref();
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

function launch(command, args, cwd, env = process.env) {
  const child = spawn(command, args, { cwd, env, stdio: "inherit" });
  children.add(child);
  child.on("error", (error) => {
    console.error(`Could not start ${command}: ${error.message}`);
    children.delete(child);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) {
      if (code || signal)
        console.error(`A service stopped (${signal || code}).`);
      stop(code ?? 1);
    }
  });
  return child;
}

async function healthy(url) {
  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    const data = await response.json();
    return response.ok && data.ok === true && Number.isInteger(data.songs);
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(python))
    throw new Error(
      "Set up backend/.venv first. See README.md → Running the backend.",
    );
  if (!existsSync(expo))
    throw new Error(
      "Install frontend dependencies first: npm --prefix app install",
    );
  const interfaces = networkInterfaces();
  const preferred = ["en0", "en1", "eth0", "wlan0"];
  const names = [...new Set([...preferred, ...Object.keys(interfaces)])];
  const host =
    process.env.MUSIC_HOST ||
    names
      .flatMap((name) => interfaces[name] || [])
      .find((address) => address.family === "IPv4" && !address.internal)
      ?.address;
  if (!host || !isIPv4(host))
    throw new Error(
      "No Wi-Fi IPv4 address found. Connect to Wi-Fi or set MUSIC_HOST to your laptop’s LAN IPv4 address.",
    );
  const api = `http://${host}:8000`;
  const localApi = "http://localhost:8000";
  if (await healthy(localApi)) {
    console.log("Using the backend already running on port 8000.");
  } else {
    console.log("Starting the music backend…");
    launch(
      python,
      ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
      resolve(root, "backend"),
    );
    const deadline = Date.now() + 30000;
    while (!(await healthy(localApi))) {
      if (stopping) return;
      if (Date.now() > deadline)
        throw new Error(
          "Backend did not become ready within 30 seconds. Check its logs above.",
        );
      await delay(250);
    }
  }
  if (stopping) return;
  if (!(await healthy(api)))
    console.warn(
      `Wi-Fi access to ${api} could not be verified. Browser access will use localhost; check local-network permissions and Wi-Fi before playing on a phone.`,
    );
  const response = await fetch(`${localApi}/songs`, {
    signal: AbortSignal.timeout(5000),
  });
  const songs = await response.json();
  if (!response.ok || !Array.isArray(songs) || !songs.length)
    throw new Error(
      "No songs available. Run backend/seed_demo_songs.py before starting the game.",
    );
  if (stopping) return;
  console.log(`\nMusically backend ready: ${songs.length} songs`);
  console.log(`Phone API: ${api} | Browser API: ${localApi}`);
  console.log(
    "Scan the Expo QR code on the same Wi-Fi. Press Ctrl+C to stop this session.\n",
  );
  launch(
    process.execPath,
    [expo, "start", "--lan", ...process.argv.slice(2)],
    resolve(root, "app"),
    {
      ...process.env,
      EXPO_PUBLIC_API_URL: api,
      EXPO_PUBLIC_WEB_API_URL: localApi,
      REACT_NATIVE_PACKAGER_HOSTNAME: host,
    },
  );
}
main().catch((error) => {
  console.error(`\n${error.message}`);
  stop(1);
});
