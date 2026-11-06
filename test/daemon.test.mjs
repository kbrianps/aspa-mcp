import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { sandbox } from "./helpers.mjs";

const root = sandbox();
const socket = join(root, "daemon.sock");
const env = {
  ...process.env,
  ASPA_SOCKET: socket,
  ASPA_WATCH: "0",
  ASPA_READ_ONLY: "1",
  ASPA_PROFILE_DIR: join(root, "profile"),
  ASPA_CHROME_PATH: "/bin/false",
};
let daemon;
let call;

const waitFor = async (check, ms = 10000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("timeout");
};

before(async () => {
  process.env.ASPA_SOCKET = socket;
  const client = await import("../client.mjs");
  call = client.call;
  daemon = spawn(process.execPath, [join(import.meta.dirname, "..", "daemon.mjs")], { env, stdio: "ignore" });
  await waitFor(() => client.socketAlive(socket));
});

after(() => daemon?.kill("SIGTERM"));

test("health answers without opening Chrome", async () => {
  const health = await call("health", {}, 5000);
  assert.equal(health.read_only, true);
  assert.equal(health.chrome.connected, false);
});

test("read-only mode refuses writes in the background service too", async () => {
  await assert.rejects(call("sendMessage", { contact: "X", text: "oi" }, 5000), (error) => error.code === "FORBIDDEN");
  await assert.rejects(call("conclude", { contact: "X" }, 5000), (error) => error.code === "FORBIDDEN");
});

test("unknown methods are rejected", async () => {
  await assert.rejects(call("deleteEverything", {}, 5000), (error) => error.code === "INVALID_INPUT");
});

test("a second daemon refuses to steal the socket", async () => {
  const second = spawn(process.execPath, [join(import.meta.dirname, "..", "daemon.mjs")], { env, stdio: "ignore" });
  const code = await new Promise((resolve) => second.on("exit", resolve));
  assert.equal(code, 1);
  const health = await call("health", {}, 5000);
  assert.ok(health.pid);
});
