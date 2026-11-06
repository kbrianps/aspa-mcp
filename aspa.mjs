import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import puppeteer from "puppeteer-core";
import { transcribeFiles, transcriptionEnabled } from "./transcription.mjs";

const APP_ORIGIN = "https://app.aspa.chat";
const LIST_URL = `${APP_ORIGIN}/atendimento`;
const ICON_LINE = /^[a-z][a-z0-9_]*$/;
const DATA_DIR = join(homedir(), ".local", "share", "aspa-mcp");
const PROFILE_DIR = process.env.ASPA_PROFILE_DIR || join(DATA_DIR, "profile");
const CACHE_DIR = process.env.ASPA_CACHE_DIR || join(homedir(), ".cache", "aspa-mcp");
const CHROME_PATH = process.env.ASPA_CHROME_PATH || "/usr/bin/google-chrome";
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const WATCH_RELOAD_MS = 30 * 60 * 1000;
const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;
const SNOOZE_LABELS = { "1h": "Em 1 hora", "1d": "Em 1 dia", "1w": "Em 1 semana" };

let browser = null;
let workPage = null;
let watchPage = null;
let visible = false;
let queue = Promise.resolve();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function exclusive(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function closeBrowser() {
  const current = browser;
  browser = null;
  workPage = null;
  watchPage = null;
  if (current?.connected) await current.close();
}

async function ensureBrowser(headful = false) {
  if (browser?.connected && visible !== headful) await closeBrowser();
  if (browser?.connected) return browser;
  mkdirSync(PROFILE_DIR, { recursive: true });
  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: PROFILE_DIR,
    headless: !headful,
    defaultViewport: headful ? null : { width: 1400, height: 900 },
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1400,900",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  });
  visible = headful;
  browser.on("disconnected", () => {
    browser = null;
    workPage = null;
    watchPage = null;
  });
  workPage = (await browser.pages())[0] ?? (await browser.newPage());
  return browser;
}

async function getWorkPage() {
  const b = await ensureBrowser();
  if (!workPage || workPage.isClosed()) workPage = await b.newPage();
  await workPage.bringToFront();
  return workPage;
}

async function getWatchPage() {
  const b = await ensureBrowser();
  if (!watchPage || watchPage.isClosed()) {
    watchPage = await b.newPage();
    await watchPage.setViewport({ width: 1400, height: 900 });
  }
  return watchPage;
}

async function sessionState(page) {
  return page.evaluate(() => {
    const panel =
      document.querySelector("button.list-otps-btn, .wrp-feed-item") ||
      [...document.querySelectorAll("button")].some((b) => /Atendimento$/.test(b.innerText.trim()));
    if (panel) return "logged_in";
    if (document.querySelector("input[type=password]")) return "logged_out";
    return "loading";
  });
}

async function waitForSession(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await sessionState(page).catch(() => "loading");
    if (state !== "loading") return state;
    await sleep(500);
  }
  return "loading";
}

async function ensureList(page, tab) {
  const onList = page.url() === LIST_URL || (page.url().startsWith(`${LIST_URL}/`) && (await page.$("button.list-otps-btn")));
  if (!onList) await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
  if ((await waitForSession(page, 30000)) === "logged_out") throw new Error("Aspa session expired or missing. Call aspa_login.");
  await page.waitForFunction(() => document.querySelectorAll("button.list-otps-btn").length > 0, { timeout: 60000 }).catch(() => null);
  const clicked = await selectTab(page, tab ?? "todos");
  if (tab && !clicked) throw new Error(`Filter tab "${tab}" not found in the Aspa panel. Another list filter may be active; clear it in the panel.`);
}

async function selectTab(page, tab) {
  const result = await page.evaluate((label) => {
    const button = [...document.querySelectorAll("button")].find((b) => b.innerText.trim().toLowerCase().startsWith(`${label} (`));
    if (!button) return "missing";
    if (button.getAttribute("aria-pressed") === "true") return "selected";
    button.click();
    return "clicked";
  }, tab);
  if (result === "clicked") await sleep(800);
  return result !== "missing";
}

async function panelLoaded(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) => {
      const match = b.innerText.trim().match(/^Todos \((\d+)\)$/);
      return match && Number(match[1]) > 0;
    }),
  );
}

async function readList(page) {
  return page.evaluate((iconPattern) => {
    const icon = new RegExp(iconPattern);
    return [...document.querySelectorAll("button.list-otps-btn")].map((button, index) => {
      const time = button.querySelector(".obtn-time")?.innerText.trim() ?? "";
      const lines = button.innerText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !icon.test(line));
      const unread = !!button.querySelector("mat-icon.mat-warn")?.innerText.trim();
      return { index, contact: lines[0] ?? "", time, unread, details: lines.slice(1).filter((line) => line !== time) };
    });
  }, ICON_LINE.source);
}

function pickConversation(items, { index, contact }) {
  if (contact) {
    const needle = contact.toLowerCase();
    const exact = items.filter((item) => item.contact.toLowerCase() === needle);
    const matches = exact.length ? exact : items.filter((item) => item.contact.toLowerCase().includes(needle));
    if (matches.length > 1) {
      throw new Error(`More than one conversation matches "${contact}": ${matches.map((m) => `${m.index}:${m.contact}`).join(", ")}. Use index.`);
    }
    return matches[0];
  }
  if (Number.isInteger(index)) return items[index];
  return undefined;
}

async function openConversation(page, target) {
  await ensureList(page, null);
  const match = pickConversation(await readList(page), target);
  if (!match) throw new Error("Conversation not found in the current list. Call aspa_list_conversations first.");
  const before = page.url();
  await page.evaluate((i) => document.querySelectorAll("button.list-otps-btn")[i].click(), match.index);
  await page.waitForFunction((previous) => location.href !== previous, { timeout: 5000 }, before).catch(() => null);
  await page.waitForSelector(".att-msg", { timeout: 25000 });
  await waitForStableFeed(page);
  return match;
}

async function waitForStableFeed(page) {
  let previous = -1;
  for (let i = 0; i < 10; i++) {
    const count = await page.evaluate(() => document.querySelectorAll(".wrp-feed-item").length);
    if (count === previous) return;
    previous = count;
    await sleep(500);
  }
}

async function loadMore(page, times) {
  for (let i = 0; i < times; i++) {
    const clicked = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Carregar Mais");
      if (!button) return false;
      button.click();
      return true;
    });
    if (!clicked) return;
    await sleep(1200);
    await waitForStableFeed(page);
  }
}

async function readFeed(page) {
  return page.evaluate((iconPattern) => {
    const icon = new RegExp(iconPattern);
    const clean = (text) =>
      text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !icon.test(line))
        .join("\n");
    const header = document.querySelector(".header-main-txt");
    const items = [...document.querySelectorAll(".wrp-feed-item")].map((item) => {
      const message = item.querySelector(".att-msg");
      if (!message) return { type: "event", text: clean(item.innerText) };
      const status = message.querySelector("[aria-label^='Entregue'], [aria-description^='Entregue']");
      const lines = clean(message.innerText).split("\n");
      const time = /^\d{1,2}:\d{2}$/.test(lines.at(-1)) ? lines.pop() : undefined;
      const bubble = message.querySelector(".att-message-bubble") ?? message;
      const fromButtons = [...bubble.querySelectorAll(".btn-attachment")].map((e) => {
        const background = getComputedStyle(e).backgroundImage.match(/url\("?(.*?)"?\)/)?.[1] ?? "";
        const inner = e.querySelector("img, audio, video, source, a[href]");
        const url = background || inner?.currentSrc || inner?.src || inner?.href || "";
        const classes = e.className;
        const kind = /image/.test(classes) ? "image" : /audio/.test(classes) ? "audio" : /video/.test(classes) ? "video" : "file";
        return { kind, url, name: e.innerText.trim() || undefined };
      });
      const fromMedia = [...bubble.querySelectorAll(":is(img, audio, video, source):not(.btn-attachment *)")]
        .filter((e) => !e.closest(".att-msg-sender-container"))
        .map((e) => {
          const tag = e.tagName.toLowerCase();
          const kind = tag === "img" ? "image" : tag === "source" ? e.parentElement.tagName.toLowerCase() : tag;
          return { kind, url: e.currentSrc || e.src || "", name: undefined };
        });
      const position = [...document.querySelectorAll(".wrp-feed-item")].indexOf(item);
      const fromFileButtons = [...bubble.querySelectorAll("button.mediaMsgBtn")].map((e, n) => {
        e.setAttribute("data-aspa-att", `f-${position}-${n}`);
        return { kind: "file", url: "", trigger: `f-${position}-${n}`, name: e.querySelector("p")?.childNodes[0]?.textContent.trim() || undefined };
      });
      const fromAudioPlayers = [...bubble.querySelectorAll("mat-icon")]
        .filter((e) => ["play_arrow", "pause"].includes(e.innerText.trim()) && e.closest(".bubble-last"))
        .map((e, n) => {
          e.setAttribute("data-aspa-att", `a-${position}-${n}`);
          return { kind: "audio", url: "", trigger: `a-${position}-${n}`, name: undefined };
        });
      const attachments = [...fromButtons.filter((a) => a.url), ...fromMedia.filter((a) => a.url), ...fromFileButtons, ...fromAudioPlayers];
      return {
        type: "message",
        direction: message.classList.contains("att-msg-sent") ? "outbound" : "inbound",
        time,
        text: lines.join("\n"),
        status: status?.getAttribute("aria-label") || status?.getAttribute("aria-description") || undefined,
        attachments: attachments.length ? attachments : undefined,
      };
    });
    return {
      contact: header?.querySelector("h2")?.innerText.trim() ?? "",
      responseWindow: header?.querySelector(".mat-caption")?.innerText.trim() || undefined,
      url: location.href,
      items: items.filter((item) => item.text || item.attachments).map((item, index) => ({ index, ...item })),
    };
  }, ICON_LINE.source);
}

async function clickHeaderIcon(page, iconName) {
  const clicked = await page.evaluate((name) => {
    const header = document.querySelector(".header-main-txt")?.getBoundingClientRect();
    if (!header) return false;
    const middle = header.top + header.height / 2;
    const button = [...document.querySelectorAll("button")].find((b) => {
      const r = b.getBoundingClientRect();
      return b.innerText.trim() === name && Math.abs(r.top + r.height / 2 - middle) < 30 && r.left > header.left;
    });
    if (!button) return false;
    button.click();
    return true;
  }, iconName);
  if (!clicked) throw new Error(`Action "${iconName}" not found in the conversation header.`);
  await sleep(700);
}

async function clickComposerPlus(page, item) {
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "loupe" && !b.closest(".cdk-overlay-container"));
    if (!button) return false;
    button.click();
    return true;
  });
  if (!clicked) throw new Error("Composer menu not found.");
  await sleep(600);
  if (!(await clickOverlay(page, "button, [role=menuitem]", item))) throw new Error(`Composer option "${item}" not found.`);
  await sleep(1000);
}

async function clickOverlay(page, selector, pattern) {
  return page.evaluate(
    (sel, source) => {
      const re = new RegExp(source);
      const element = [...document.querySelectorAll(`.cdk-overlay-container :is(${sel})`)].find((e) => re.test(e.innerText.trim()));
      if (!element) return false;
      element.click();
      return true;
    },
    selector,
    pattern,
  );
}

async function overlayTexts(page, selector) {
  return page.evaluate(
    (sel, iconPattern) => {
      const icon = new RegExp(iconPattern);
      return [...document.querySelectorAll(`.cdk-overlay-container :is(${sel})`)].map((e) =>
        e.innerText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !icon.test(l))
          .join(" ")
          .replace(/^[a-z_]+ /, ""),
      );
    },
    selector,
    ICON_LINE.source,
  );
}

async function dialogOpen(page) {
  return page.evaluate(() => !!document.querySelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container)"));
}

async function closeOverlays(page) {
  for (let i = 0; i < 4; i++) {
    const closed = await page.evaluate(() => {
      const button = [...document.querySelectorAll(".cdk-overlay-container button")].find((b) => /^(Cancelar|close|Fechar)$/.test(b.innerText.trim()));
      if (button) {
        button.click();
        return true;
      }
      const backdrop = document.querySelector(".cdk-overlay-backdrop");
      if (backdrop) {
        backdrop.click();
        return true;
      }
      return false;
    });
    if (!closed) return;
    await sleep(500);
  }
  await page.keyboard.press("Escape");
}

async function waitDialogClosed(page, timeout = 15000) {
  await page.waitForFunction(() => !document.querySelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container)"), { timeout });
}

async function chooseOption(page, wanted, what) {
  await page.waitForSelector(".cdk-overlay-container mat-option", { timeout: 10000 });
  const options = await page.evaluate((iconPattern) => {
    const icon = new RegExp(iconPattern);
    return [...document.querySelectorAll(".cdk-overlay-container mat-option")].map((option) => {
      const first = option.innerText
        .split("\n")
        .map((t) => t.trim())
        .find((t) => t && !icon.test(t));
      return (first ?? "").replace(/^[a-z][a-z0-9_]* /, "");
    });
  }, ICON_LINE.source);
  const needle = wanted.toLowerCase();
  const exact = options.map((text, i) => ({ text, i })).filter((o) => o.text.toLowerCase() === needle);
  const partial = options.map((text, i) => ({ text, i })).filter((o) => o.text.toLowerCase().includes(needle));
  const picked = exact.length === 1 ? exact : partial;
  if (picked.length !== 1) {
    await closeOverlays(page);
    throw new Error(`${what} "${wanted}" ${picked.length ? "is ambiguous" : "not found"}. Options: ${options.join(" | ")}`);
  }
  await page.evaluate((i) => document.querySelectorAll(".cdk-overlay-container mat-option")[i].click(), picked[0].i);
  await sleep(800);
  return picked[0].text;
}

async function countSent(page) {
  return page.evaluate(() => document.querySelectorAll(".att-msg-sent").length);
}

async function waitSentIncrease(page, before) {
  try {
    await page.waitForFunction((n) => document.querySelectorAll(".att-msg-sent").length > n, { timeout: 30000 }, before);
  } catch {
    throw new Error("The panel did not show the new message within 30 s. Check the conversation in Aspa before retrying.");
  }
}

export const login = () =>
  exclusive(async () => {
    await closeBrowser();
    await ensureBrowser(true);
    const page = workPage;
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    await page.bringToFront();
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    try {
      while (Date.now() < deadline) {
        if ((await sessionState(page).catch(() => "loading")) === "logged_in") {
          await sleep(2000);
          return { loggedIn: true, profile: PROFILE_DIR };
        }
        await sleep(1000);
      }
      throw new Error("Login not completed within 5 minutes.");
    } finally {
      await closeBrowser();
    }
  });

export const listConversations = ({ tab } = {}) =>
  exclusive(async () => {
    const page = await getWorkPage();
    await ensureList(page, tab);
    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter((t) => /^(Todos|Meus|Pendentes) \(\d+\)$/.test(t)),
    );
    return { tabs, conversations: await readList(page) };
  });

export const readConversation = ({ index, contact, loadMoreTimes = 0 } = {}) =>
  exclusive(async () => {
    const page = await getWorkPage();
    await openConversation(page, { index, contact });
    if (loadMoreTimes > 0) await loadMore(page, loadMoreTimes);
    return readFeed(page);
  });

export const sendMessage = ({ index, contact, text }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    const before = await countSent(page);
    const state = await page.evaluate((value) => {
      const box = document.querySelector("textarea.cdk-textarea-autosize");
      if (!box) return "missing";
      if (box.disabled || box.readOnly) return "disabled";
      if (box.value.trim()) return "busy";
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, value);
      box.dispatchEvent(new Event("input", { bubbles: true }));
      return "ok";
    }, text);
    if (state === "busy") throw new Error("The reply box already has text in the panel. Clear it before sending.");
    if (state !== "ok") throw new Error("Reply box is not available. The 24h window may be closed; use aspa_send_template.");
    await sleep(400);
    const clicked = await page.evaluate(() => {
      const box = document.querySelector("textarea.cdk-textarea-autosize");
      let scope = box;
      for (let i = 0; i < 10 && scope; i++, scope = scope.parentElement) {
        const button = [...scope.querySelectorAll("button")].find((b) => b.innerText.trim() === "send");
        if (button) {
          if (button.disabled) return false;
          button.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) {
      await page.evaluate(() => {
        const box = document.querySelector("textarea.cdk-textarea-autosize");
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, "");
        box.dispatchEvent(new Event("input", { bubbles: true }));
      });
      throw new Error("Send button not available. The 24h window may be closed; use aspa_send_template.");
    }
    await waitSentIncrease(page, before);
    return { sent: true, contact: match.contact };
  });

export const listTemplates = ({ index, contact }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    await openConversation(page, { index, contact });
    await clickComposerPlus(page, "Mensagem Modelo");
    await page.waitForSelector(".cdk-overlay-container mat-option", { timeout: 10000 }).catch(() => null);
    const templates = await page.evaluate((iconPattern) => {
      const icon = new RegExp(iconPattern);
      return [...document.querySelectorAll(".cdk-overlay-container mat-option")].map((option) => {
        const lines = option.innerText
          .split("\n")
          .map((t) => t.trim())
          .filter((t) => t && !icon.test(t));
        if (lines.length >= 2) return { name: lines[0].replace(/^[a-z][a-z0-9_]* /, ""), preview: lines.slice(1).join(" ") };
        const leaves = [...option.querySelectorAll("*")]
          .filter((e) => e.childElementCount === 0 && e.innerText?.trim())
          .map((e) => e.innerText.trim())
          .filter((t) => !icon.test(t));
        return { name: leaves[0] ?? "", preview: leaves.slice(1).join(" ") };
      });
    }, ICON_LINE.source);
    await closeOverlays(page);
    return { templates };
  });

export const sendTemplate = ({ index, contact, template, variables = [] }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    const before = await countSent(page);
    await clickComposerPlus(page, "Mensagem Modelo");
    const input = await page.waitForSelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) input", { timeout: 10000 });
    await input.evaluate((e) => e.setAttribute("data-aspa-template", "1"));
    await input.click();
    await input.type(template);
    await chooseOption(page, template, "Template");
    const fields = await page.$$(
      ".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) :is(input, textarea):not([data-aspa-template]):not([type=hidden]):not([type=file])",
    );
    const editable = [];
    for (const field of fields) {
      if (await field.evaluate((e) => e.offsetParent !== null && !e.readOnly && !e.disabled)) editable.push(field);
    }
    if (editable.length !== variables.length) {
      await closeOverlays(page);
      throw new Error(`Template "${template}" expects ${editable.length} variable(s); received ${variables.length}.`);
    }
    for (const [i, field] of editable.entries()) {
      await field.click({ clickCount: 3 });
      await field.type(String(variables[i]));
    }
    if (!(await clickOverlay(page, "button", "Enviar$"))) {
      await closeOverlays(page);
      throw new Error("Send button not found in the template dialog.");
    }
    await waitDialogClosed(page);
    await waitSentIncrease(page, before);
    return { sent: true, contact: match.contact, template };
  });

export const sendAttachment = ({ index, contact, path, caption }) =>
  exclusive(async () => {
    if (!existsSync(path)) throw new Error(`File not found: ${path}`);
    if (statSync(path).size > MAX_ATTACHMENT_BYTES) throw new Error("File is larger than 16 MB.");
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    const before = await countSent(page);
    await clickComposerPlus(page, "Inserir Anexo");
    const input = await page.waitForSelector(".cdk-overlay-container input[type=file]", { timeout: 10000 });
    await input.uploadFile(path);
    await sleep(1500);
    if (!(await clickOverlay(page, "button", "^Confirmar$"))) {
      await closeOverlays(page);
      throw new Error("Confirm button not found in the attachment dialog.");
    }
    await sleep(2000);
    let sent = false;
    if (await dialogOpen(page)) {
      if (caption) {
        const field = await page.$(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) :is(textarea, input[type=text])");
        if (field) await field.type(caption);
      }
      sent = await clickOverlay(page, "button", "(Enviar|send)$");
    } else {
      sent = await page.evaluate((text) => {
        const box = document.querySelector("textarea.cdk-textarea-autosize");
        if (box && text) {
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, text);
          box.dispatchEvent(new Event("input", { bubbles: true }));
        }
        let scope = box;
        for (let i = 0; i < 10 && scope; i++, scope = scope.parentElement) {
          const button = [...scope.querySelectorAll("button")].find((b) => b.innerText.trim() === "send");
          if (button && !button.disabled) {
            button.click();
            return true;
          }
        }
        return false;
      }, caption ?? "");
    }
    if (!sent) {
      const buttons = await overlayTexts(page, "button");
      await closeOverlays(page);
      throw new Error(`Could not find the send step after confirming the attachment. Dialog buttons: ${buttons.join(" | ") || "none"}`);
    }
    await waitSentIncrease(page, before);
    return { sent: true, contact: match.contact, file: basename(path) };
  });

export const transfer = ({ index, contact, to, comment }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    await clickHeaderIcon(page, "swap_horiz");
    const input = await page.waitForSelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) input", { timeout: 10000 });
    await input.click();
    await input.type(to);
    const chosen = await chooseOption(page, to, "Destination");
    if (comment) {
      const field = await page.$(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) textarea");
      if (field) await field.type(comment);
    }
    if (!(await clickOverlay(page, "button", "Transferir$"))) {
      await closeOverlays(page);
      throw new Error("Transfer button not found in the dialog.");
    }
    await waitDialogClosed(page);
    return { transferred: true, contact: match.contact, to: chosen };
  });

export const snooze = ({ index, contact, duration }) =>
  exclusive(async () => {
    const label = SNOOZE_LABELS[duration];
    if (!label) throw new Error(`Invalid duration "${duration}". Use 1h, 1d or 1w.`);
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    await clickHeaderIcon(page, "alarm");
    if (!(await clickOverlay(page, "button, [role=menuitem]", `^${label}$`))) {
      await closeOverlays(page);
      throw new Error(`Snooze option "${label}" not found.`);
    }
    await sleep(1500);
    if (await dialogOpen(page)) await clickOverlay(page, "button", "^(Confirmar|Adiar|Sim)$");
    await sleep(2000);
    await ensureList(page, null);
    const stillOpen = (await readList(page)).some((item) => item.contact === match.contact);
    return { snoozed: !stillOpen, contact: match.contact, duration: label, verified: !stillOpen };
  });

export const conclude = ({ index, contact }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    await clickHeaderIcon(page, "task_alt");
    await sleep(1200);
    if (await dialogOpen(page)) {
      if (!(await clickOverlay(page, "button", "(Concluir|Confirmar|Sim)$"))) {
        const buttons = await overlayTexts(page, "button");
        await closeOverlays(page);
        throw new Error(`Unexpected conclude dialog. Buttons: ${buttons.join(" | ")}`);
      }
      await waitDialogClosed(page).catch(() => null);
    }
    await sleep(2500);
    await ensureList(page, null);
    const stillOpen = (await readList(page)).some((item) => item.contact === match.contact);
    return { concluded: !stillOpen, contact: match.contact, verified: !stillOpen };
  });

export const reopen = ({ contact }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    await ensureList(page, null);
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Atendimentos Concluídos"))?.click());
    await page.waitForFunction(() => location.pathname.startsWith("/concluidos"), { timeout: 15000 });
    await page.waitForSelector("tr.mat-mdc-row", { timeout: 60000 });
    await sleep(1000);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll("tr.mat-mdc-row")].map((row, index) => ({ index, contact: row.querySelector("td")?.innerText.split("\n")[0].trim() ?? "" })),
    );
    const match = pickConversation(rows, { contact });
    if (!match) throw new Error(`No concluded conversation matches "${contact}" on the first page of 'Atendimentos Concluídos' (last week).`);
    await page.evaluate((i) => document.querySelectorAll("tr.mat-mdc-row")[i].querySelector("td").click(), match.index);
    await page.waitForSelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container)", { timeout: 15000 });
    await sleep(1000);
    if (!(await clickOverlay(page, "button", "^open_in_new$"))) {
      const buttons = await overlayTexts(page, "button");
      await closeOverlays(page);
      throw new Error(`Reopen control not found in the conversation preview. Buttons: ${buttons.join(" | ")}`);
    }
    await page.waitForFunction(() => location.pathname.startsWith("/atendimento/"), { timeout: 20000 });
    await page
      .waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Iniciar"), { timeout: 20000 })
      .catch(() => null);
    const started = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Iniciar");
      if (!button) return false;
      button.click();
      return true;
    });
    if (!started) throw new Error("The 'Iniciar' button was not found on the concluded conversation.");
    await sleep(3000);
    if (await dialogOpen(page)) await clickOverlay(page, "button", "(Iniciar|Confirmar|Sim)$");
    await sleep(2000);
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    await ensureList(page, null);
    const reopened = (await readList(page)).some((item) => item.contact.toLowerCase().includes(match.contact.toLowerCase()));
    return { reopened, contact: match.contact, verified: reopened };
  });

export const renameContact = ({ index, contact, name }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    const opened = await page.evaluate(() => {
      const pencil = [...document.querySelectorAll("mat-icon, button")].find((e) => e.innerText.trim() === "edit" && e.getBoundingClientRect().x > 1000);
      if (!pencil) return false;
      (pencil.closest("button") ?? pencil).click();
      return true;
    });
    if (!opened) throw new Error("Contact edit control not found. The contact panel may be closed.");
    await sleep(600);
    const field = await page.evaluateHandle(() =>
      [...document.querySelectorAll("input")].find((e) => e.getBoundingClientRect().x > 1000 && !e.readOnly && !e.disabled),
    );
    const input = field.asElement();
    if (!input) throw new Error("Contact name field not found.");
    const previous = await input.evaluate((e) => e.value);
    await input.evaluate((e) => {
      e.focus();
      e.select();
    });
    await page.keyboard.press("Backspace");
    await input.type(name);
    if ((await input.evaluate((e) => e.value)) !== name) {
      await input.evaluate((e, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, value);
        e.dispatchEvent(new Event("input", { bubbles: true }));
      }, previous);
      throw new Error("Could not type the new name; the field was restored without saving.");
    }
    await page.keyboard.press("Enter");
    await sleep(2500);
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    await openConversation(page, { contact: match.contact });
    await sleep(1500);
    const saved = await page.evaluate(
      () => [...document.querySelectorAll("input")].find((e) => e.getBoundingClientRect().x > 1000 && !e.readOnly && !e.disabled)?.value ?? "",
    );
    return { renamed: saved === name, previous, saved, contact: match.contact };
  });

async function captureMediaUrl(page, attachment) {
  const storage = /^https:\/\/(storage\.googleapis\.com|firebasestorage\.googleapis\.com)\//;
  let captured = "";
  const onRequest = (request) => {
    if (!captured && storage.test(request.url())) captured = request.url();
  };
  const onTarget = async (target) => {
    if (target.type() !== "page") return;
    if (!captured && storage.test(target.url())) captured = target.url();
    const popup = await target.page().catch(() => null);
    if (popup && popup !== page && popup !== watchPage) {
      await sleep(1500);
      if (!captured && storage.test(popup.url())) captured = popup.url();
      await popup.close().catch(() => null);
    }
  };
  page.on("request", onRequest);
  browser.on("targetcreated", onTarget);
  await page.setCacheEnabled(false);
  try {
    await page.evaluate((id) => {
      const trigger = document.querySelector(`[data-aspa-att="${id}"]`);
      if (trigger?.innerText.trim() === "pause") trigger.click();
    }, attachment.trigger);
    await sleep(300);
    await page.evaluate((id) => document.querySelector(`[data-aspa-att="${id}"]`)?.click(), attachment.trigger);
    for (let i = 0; i < 20 && !captured; i++) await sleep(500);
  } finally {
    page.off("request", onRequest);
    browser.off("targetcreated", onTarget);
    await page.setCacheEnabled(true);
    if (attachment.kind === "audio") {
      await page.evaluate((id) => {
        const icon = document.querySelector(`[data-aspa-att="${id}"]`);
        if (icon?.innerText.trim() === "pause") icon.click();
      }, attachment.trigger);
    }
  }
  return captured;
}

export const transcribeAudio = async ({ index, contact, loadMoreTimes = 0, messageIndexes }) => {
  if (!transcriptionEnabled()) await transcribeFiles([]);
  const downloaded = await downloadAttachments({ index, contact, loadMoreTimes, messageIndexes });
  const audio = downloaded.files.filter((file) => file.path && (file.kind === "audio" || /^(audio|video\/ogg)/.test(file.type ?? "")));
  if (!audio.length) {
    const errors = downloaded.files.filter((file) => file.error);
    return { contact: downloaded.contact, transcripts: [], note: "No downloadable audio found in the selected messages.", errors: errors.length ? errors : undefined };
  }
  const results = await transcribeFiles(audio.map((file) => file.path));
  return {
    contact: downloaded.contact,
    transcripts: results.map((result, i) => ({ message: audio[i].message, duration: result.duration, language: result.language, text: result.text })),
  };
};

export const downloadAttachments = ({ index, contact, loadMoreTimes = 0, messageIndexes }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    if (loadMoreTimes > 0) await loadMore(page, loadMoreTimes);
    const feed = await readFeed(page);
    const wanted = feed.items.filter((item) => item.attachments && (!messageIndexes || messageIndexes.includes(item.index)));
    const folder = join(CACHE_DIR, "attachments", match.contact.replace(/[^\p{L}\p{N}_-]+/gu, "_"));
    mkdirSync(folder, { recursive: true });
    const files = [];
    for (const item of wanted) {
      for (const [n, attachment] of item.attachments.entries()) {
        if (!attachment.url && attachment.trigger) attachment.url = await captureMediaUrl(page, attachment);
        if (!attachment.url && attachment.trigger) {
          await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
          await openConversation(page, { contact: match.contact });
          if (loadMoreTimes > 0) await loadMore(page, loadMoreTimes);
          await readFeed(page);
          attachment.url = await captureMediaUrl(page, attachment);
        }
        if (!attachment.url) {
          files.push({ message: item.index, kind: attachment.kind, name: attachment.name, error: "Could not resolve the attachment URL." });
          continue;
        }
        let data = await fetch(attachment.url)
          .then(async (response) =>
            response.ok
              ? { type: response.headers.get("content-type") ?? "", base64: Buffer.from(await response.arrayBuffer()).toString("base64") }
              : { error: `HTTP ${response.status}` },
          )
          .catch((error) => ({ error: error.message }));
        if (data.error) {
          data = await page.evaluate(async (url) => {
            const response = await fetch(url, { credentials: "omit", cache: "no-store" });
            if (!response.ok) return { error: `HTTP ${response.status}` };
            const bytes = new Uint8Array(await response.arrayBuffer());
            let binary = "";
            for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            return { type: response.headers.get("content-type") ?? "", base64: btoa(binary) };
          }, attachment.url);
        }
        if (data.error) {
          files.push({ message: item.index, kind: attachment.kind, error: data.error });
          continue;
        }
        const extension = (data.type.split("/")[1] ?? "bin").split(";")[0].replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "bin";
        const fileName = `${item.index}-${n}-${(attachment.name ?? attachment.kind).replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 60)}`;
        const path = join(folder, fileName.includes(".") ? fileName : `${fileName}.${extension}`);
        writeFileSync(path, Buffer.from(data.base64, "base64"));
        files.push({ message: item.index, kind: attachment.kind, type: data.type, path });
      }
    }
    return { contact: match.contact, folder, files };
  });

export function startWatcher({ intervalMs, tabs = ["meus"], onActivity, onSessionLost }) {
  let known = null;
  let lastReload = 0;
  let sessionLost = false;
  const tick = () =>
    exclusive(async () => {
      const page = await getWatchPage();
      if (Date.now() - lastReload > WATCH_RELOAD_MS || page.url() !== LIST_URL) {
        await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
        lastReload = Date.now();
      }
      const state = await waitForSession(page, 30000);
      if (state === "logged_out") {
        if (!sessionLost) onSessionLost();
        sessionLost = true;
        return;
      }
      sessionLost = false;
      if (state !== "logged_in") return;
      await page.waitForFunction(() => document.querySelectorAll("button.list-otps-btn").length > 0, { timeout: 30000 }).catch(() => null);
      if (!(await panelLoaded(page))) return;
      const next = new Map();
      for (const tab of typeof tabs === "function" ? tabs() : tabs) {
        if (!(await selectTab(page, tab))) {
          console.error(`[watch] tab "${tab}" not found`);
          return;
        }
        for (const item of await readList(page)) next.set(item.contact, item);
      }
      if (known) {
        for (const item of next.values()) {
          const previous = known.get(item.contact);
          if (!previous || previous.time !== item.time || (item.unread && !previous.unread)) onActivity(item);
        }
      }
      known = next;
    });
  const run = () => tick().catch((error) => console.error(`[watch] ${error.message}`));
  run();
  return setInterval(run, intervalMs);
}

export async function shutdown() {
  await closeBrowser().catch(() => {});
}
