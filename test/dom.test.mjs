import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { sandbox } from "./helpers.mjs";

sandbox();
const { CHROME_PATH, PAGE_HELPERS } = await import("../browser.mjs");
const { parseFeedInPage, parseListInPage } = await import("../panel.mjs");
const { ICON_LINE } = await import("../ui-map.mjs");
const puppeteer = (await import("puppeteer-core")).default;

const available = existsSync(CHROME_PATH);
const profile = mkdtempSync(join(tmpdir(), "aspa-mcp-dom-"));
let browser;
let page;

before(async () => {
  if (!available) return;
  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true, userDataDir: profile, args: ["--no-sandbox"] });
  page = await browser.newPage();
  await page.setContent(readFileSync(join(import.meta.dirname, "fixtures", "panel.html"), "utf8"));
  await page.evaluate(PAGE_HELPERS);
});

after(async () => {
  await browser?.close();
  rmSync(profile, { recursive: true, force: true });
});

test("parses the conversation list", { skip: !available && "Chrome not installed" }, async () => {
  const items = await page.evaluate(parseListInPage, ICON_LINE.source);
  assert.equal(items.length, 3);
  assert.equal(items[0].contact, "Maria Exemplo");
  assert.equal(items[0].time, "13:12");
  assert.equal(items[0].unread, true);
  assert.equal(items[0].assigned, true);
  assert.equal(items[0].agent, "Ana Atendente");
  assert.equal(items[1].unread, false);
  assert.equal(items[1].assigned, false);
  assert.equal(items[2].contact, "Carla Exemplo");
  assert.equal(items[2].assigned, null);
});

test("keeps short customer replies and drops icon names", { skip: !available && "Chrome not installed" }, async () => {
  const feed = await page.evaluate(parseFeedInPage, ICON_LINE.source);
  assert.equal(feed.contact, "Maria Exemplo");
  assert.equal(feed.responseWindow, "9h para responder");
  const messages = feed.items.filter((item) => item.type === "message");
  assert.deepEqual(
    messages.map((m) => [m.direction, m.text, m.time]),
    [
      ["inbound", "sim", "14:16"],
      ["inbound", "ok", "14:17"],
      ["outbound", "Bom dia! Já verificamos.\nQualquer coisa, estamos aqui.", "14:20"],
    ],
  );
  assert.ok(feed.items.some((item) => item.type === "event" && /assumiu/.test(item.text)));
  assert.ok(!JSON.stringify(feed.items).match(/reply|content_copy/));
});
