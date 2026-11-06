import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { sandbox } from "./helpers.mjs";

const root = sandbox();
const WRITE_TOOLS = [
  "aspa_send_message",
  "aspa_send_template",
  "aspa_send_attachment",
  "aspa_reply_to_message",
  "aspa_transfer",
  "aspa_assume",
  "aspa_snooze",
  "aspa_snooze_until",
  "aspa_conclude",
  "aspa_reopen",
  "aspa_rename_contact",
  "aspa_mark_unread",
  "aspa_create_contact",
  "aspa_block_promotions",
];

async function listTools(extraEnv) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(import.meta.dirname, "..", "index.mjs")],
    env: { ...process.env, ASPA_SOCKET: join(root, "none.sock"), ...extraEnv },
    stderr: "ignore",
  });
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(transport);
  const { tools } = await client.listTools();
  const { instructions } = { instructions: client.getInstructions() };
  await client.close();
  return { tools, names: tools.map((t) => t.name), instructions };
}

test("read-only mode exposes no tool that changes conversations or updates the code", async () => {
  const { names, instructions } = await listTools({ ASPA_READ_ONLY: "1" });
  for (const name of [...WRITE_TOOLS, "aspa_update"]) assert.ok(!names.includes(name), `${name} must be hidden`);
  for (const name of ["aspa_list_conversations", "aspa_read_conversation", "aspa_open_draft", "aspa_login", "aspa_setup_check"]) {
    assert.ok(names.includes(name), `${name} must be available`);
  }
  assert.match(instructions, /read-only/);
});

test("full mode requires the contact name on every write tool", async () => {
  const { tools, names } = await listTools({});
  for (const name of WRITE_TOOLS) assert.ok(names.includes(name), `${name} must exist`);
  for (const tool of tools.filter((t) => WRITE_TOOLS.includes(t.name) && t.name !== "aspa_create_contact")) {
    assert.ok(tool.inputSchema.required?.includes("contact"), `${tool.name} must require contact`);
    assert.equal(tool.annotations?.readOnlyHint, false, `${tool.name} must not be read-only`);
  }
});

test("a call without the background service returns a clear error code", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(import.meta.dirname, "..", "index.mjs")],
    env: { ...process.env, ASPA_SOCKET: join(root, "none.sock") },
    stderr: "ignore",
  });
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(transport);
  const result = await client.callTool({ name: "aspa_statistics", arguments: {} });
  await client.close();
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /DAEMON_DOWN/);
});
