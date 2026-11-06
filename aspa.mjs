import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, lstatSync, mkdirSync, readlinkSync, realpathSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative, sep } from "node:path";
import puppeteer from "puppeteer-core";
import { AspaError, CODES, fail } from "./errors.mjs";
import { transcribeFiles, transcriptionEnabled } from "./transcription.mjs";

const APP_ORIGIN = "https://app.aspa.chat";
const LIST_URL = `${APP_ORIGIN}/atendimento`;
const ICON_LINE = /^[a-z]+(_[a-z]+)+$/;
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
let chromeProcess = null;
let queue = Promise.resolve();
let queued = 0;
let interactive = null;
let launchFailures = 0;
const requestContext = new AsyncLocalStorage();
const watcherHealth = { lastTickOkAt: null, consecutiveFailures: 0, lastError: null, degraded: false };

export const interactiveMode = () => interactive;
export const withRequest = (signal, fn) => requestContext.run({ signal }, fn);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function exclusive(fn) {
  const signal = requestContext.getStore()?.signal;
  queued += 1;
  if (queued > 3) console.error(`[queue] ${queued} actions waiting`);
  const task = () => {
    queued -= 1;
    if (signal?.aborted) throw new AspaError(CODES.CANCELLED, "O pedido foi cancelado antes de começar; nada foi feito no Aspa.");
    return fn();
  };
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export function health() {
  return {
    chrome: { connected: !!browser?.connected, pid: chromeProcess?.pid ?? null, visible },
    queue: queued,
    interactive,
    watcher: { ...watcherHealth },
  };
}

function killChrome(processHandle) {
  if (processHandle && processHandle.exitCode === null && processHandle.signalCode === null) {
    try {
      processHandle.kill("SIGKILL");
    } catch {}
  }
}

function clearStaleProfileLock() {
  const lock = join(PROFILE_DIR, "SingletonLock");
  let target;
  try {
    if (!lstatSync(lock).isSymbolicLink()) return;
    target = readlinkSync(lock);
  } catch {
    return;
  }
  const pid = Number(target.split("-").pop());
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0);
      return;
    } catch (error) {
      if (error.code !== "ESRCH") return;
    }
  }
  for (const name of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    try {
      unlinkSync(join(PROFILE_DIR, name));
    } catch {}
  }
  console.error("[chrome] removed a stale profile lock");
}

function assertDisplay() {
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    fail(
      CODES.NO_DISPLAY,
      "Não há tela disponível para abrir a janela do Aspa (DISPLAY/WAYLAND_DISPLAY vazios). Reinstale o serviço numa sessão gráfica com npm run install-service.",
    );
  }
}

async function closeBrowser() {
  const current = browser;
  const processHandle = chromeProcess;
  browser = null;
  workPage = null;
  watchPage = null;
  chromeProcess = null;
  if (current?.connected) await current.close().catch(() => null);
  killChrome(processHandle);
}

const PAGE_HELPERS = () => {
  window.__aspaText = (element) => {
    if (!element) return "";
    const icons = [...element.querySelectorAll("mat-icon, .material-icons, .material-symbols-outlined, .material-icons-outlined")];
    const previous = icons.map((icon) => icon.style.getPropertyValue("display"));
    icons.forEach((icon) => icon.style.setProperty("display", "none", "important"));
    const text = element.innerText;
    icons.forEach((icon, i) => {
      icon.style.removeProperty("display");
      if (previous[i]) icon.style.setProperty("display", previous[i]);
    });
    return text;
  };
};

const preparedPages = new WeakSet();
async function preparePage(page) {
  if (!preparedPages.has(page)) {
    preparedPages.add(page);
    await page.evaluateOnNewDocument(PAGE_HELPERS);
  }
  await page.evaluate(PAGE_HELPERS).catch(() => null);
  return page;
}

async function ensureBrowser(headful = false) {
  if (browser?.connected && visible !== headful) await closeBrowser();
  if (browser?.connected) return browser;
  mkdirSync(PROFILE_DIR, { recursive: true });
  clearStaleProfileLock();
  try {
    browser = await launchChrome(headful);
    launchFailures = 0;
  } catch (error) {
    launchFailures += 1;
    console.error(`[chrome] launch failed (${launchFailures}/3): ${error.message}`);
    if (launchFailures >= 3) {
      console.error("[chrome] giving up after 3 failed launches; exiting so systemd restarts the service");
      setTimeout(() => process.exit(1), 500);
    }
    throw new AspaError(CODES.INTERNAL, `Não consegui abrir o Chrome: ${error.message}`);
  }
  chromeProcess = browser.process();
  visible = headful;
  const launched = browser;
  const launchedProcess = chromeProcess;
  browser.on("disconnected", () => {
    killChrome(launchedProcess);
    if (browser !== launched) return;
    browser = null;
    workPage = null;
    watchPage = null;
    chromeProcess = null;
  });
  workPage = await preparePage((await browser.pages())[0] ?? (await browser.newPage()));
  return browser;
}

function launchChrome(headful) {
  return puppeteer.launch({
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
}

async function getWorkPage() {
  const b = await ensureBrowser();
  if (!workPage || workPage.isClosed()) workPage = await preparePage(await b.newPage());
  await workPage.bringToFront();
  return workPage;
}

async function getWatchPage() {
  const b = await ensureBrowser();
  if (!watchPage || watchPage.isClosed()) {
    watchPage = await preparePage(await b.newPage());
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
  if ((await waitForSession(page, 30000)) === "logged_out") fail(CODES.SESSION_EXPIRED, "A sessão do Aspa expirou ou não existe. Chame aspa_login para entrar de novo.");
  await page.waitForFunction(() => document.querySelectorAll("button.list-otps-btn").length > 0, { timeout: 60000 }).catch(() => null);
  if ((await activeFilterChips(page)).length) await clearListFilters(page);
  const clicked = await selectTab(page, tab ?? "todos");
  if (tab && !clicked) fail(CODES.UI_CHANGED, `A aba "${tab}" não foi encontrada no painel. Outro filtro da lista pode estar ativo; limpe-o no painel.`);
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
  await page
    .waitForFunction(
      () => {
        const items = document.querySelectorAll("button.list-otps-btn");
        const captions = document.querySelectorAll("button.list-otps-btn .btn-main-txt .mat-caption");
        return items.length > 0 && captions.length >= items.length;
      },
      { timeout: 3000 },
    )
    .catch(() => null);
  return page.evaluate((iconPattern) => {
    const icon = new RegExp(iconPattern);
    const textOf = (element) => (window.__aspaText ? window.__aspaText(element) : element.innerText);
    const linesOf = (element) =>
      textOf(element)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !icon.test(line));
    return [...document.querySelectorAll("button.list-otps-btn")].map((button, index) => {
      const time = button.querySelector(".obtn-time")?.innerText.trim() ?? "";
      const lines = linesOf(button);
      const unread = !!button.querySelector("mat-icon.mat-warn")?.innerText.trim();
      const captions = [...button.querySelectorAll(".btn-main-txt .mat-caption, .btn-main-txt small, .btn-main-txt span")]
        .map((e) => linesOf(e).join(" "))
        .filter(Boolean);
      const agentCaption = button.querySelector(".btn-main-txt .mat-caption");
      const hasAgentIcon = agentCaption?.querySelector("mat-icon")?.textContent.trim() === "support_agent";
      const agentName = hasAgentIcon ? linesOf(agentCaption).join(" ").replace(/\s+/g, " ").trim() : "";
      const details = lines.slice(1).filter((line) => line !== time);
      const assigned = hasAgentIcon && !details.some((line) => /sem usu[aá]rio/i.test(line));
      return { index, contact: lines[0] ?? "", time, unread, assigned, agent: assigned ? agentName || null : null, details, captions };
    });
  }, ICON_LINE.source);
}

const comparable = (value) => normalizeText(value).replace(/\s+/g, " ").trim();

export function sameContact(shown, expected) {
  const a = comparable(shown);
  const b = comparable(expected);
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a)));
}

export function conversationIdFrom(url) {
  try {
    return new URL(url).pathname.match(/^\/atendimento\/([^/?#]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function pickConversation(items, { index, contact }) {
  if (contact) {
    const needle = comparable(contact);
    const exact = items.filter((item) => comparable(item.contact) === needle);
    const matches = exact.length ? exact : items.filter((item) => comparable(item.contact).includes(needle));
    if (matches.length > 1) {
      const byIndex = Number.isInteger(index) ? matches.find((m) => m.index === index) : undefined;
      if (byIndex) return byIndex;
      fail(
        CODES.AMBIGUOUS,
        `Mais de uma conversa corresponde a "${contact}": ${matches.map((m) => `${m.index}:${m.contact}`).join(", ")}. Informe também o index da conversa certa.`,
      );
    }
    return matches[0];
  }
  if (Number.isInteger(index)) return items[index];
  return undefined;
}

async function currentConversation(page) {
  return page.evaluate(() => ({ header: document.querySelector(".header-main-txt h2")?.innerText.trim() ?? "", url: location.href }));
}

async function assertStillOn(page, match) {
  const state = await currentConversation(page);
  const idChanged = match.conversation_id && conversationIdFrom(state.url) !== match.conversation_id;
  if (!sameContact(state.header, match.contact) || idChanged) {
    fail(
      CODES.WRONG_CONVERSATION,
      `A conversa aberta no painel mudou (esperado "${match.contact}", aberto "${state.header || "nenhuma"}"). Nada foi enviado ou alterado.`,
    );
  }
}

async function openConversation(page, target, { write = false } = {}) {
  if (write && !String(target.contact ?? "").trim()) {
    fail(CODES.INVALID_INPUT, "Informe o nome do contato (contact) em toda ação que muda uma conversa; o index sozinho não basta.");
  }
  await ensureList(page, null);
  const match = pickConversation(await readList(page), target);
  if (!match) fail(CODES.NOT_FOUND, "Conversa não encontrada na lista de conversas abertas. Chame aspa_list_conversations primeiro.");
  const before = page.url();
  await page.evaluate((i) => document.querySelectorAll("button.list-otps-btn")[i].click(), match.index);
  await page.waitForFunction((previous) => location.href !== previous, { timeout: 5000 }, before).catch(() => null);
  await page.waitForSelector(".att-msg", { timeout: 25000 });
  await waitForStableFeed(page);
  let state = await currentConversation(page);
  for (let i = 0; i < 20 && !sameContact(state.header, match.contact); i++) {
    await sleep(500);
    state = await currentConversation(page);
  }
  if (!sameContact(state.header, match.contact)) {
    fail(CODES.WRONG_CONVERSATION, `O painel abriu "${state.header || "nenhuma conversa"}" em vez de "${match.contact}". Nada foi feito.`);
  }
  match.conversation_id = conversationIdFrom(state.url);
  if (target.conversation_id && match.conversation_id !== target.conversation_id) {
    fail(
      CODES.WRONG_CONVERSATION,
      `A conversa "${match.contact}" aberta agora (${match.conversation_id ?? "sem id"}) não é a mesma que foi lida antes (${target.conversation_id}). Leia a conversa de novo.`,
    );
  }
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
    const textOf = (element) => (window.__aspaText ? window.__aspaText(element) : element.innerText);
    const clean = (element) =>
      textOf(element)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !icon.test(line))
        .join("\n");
    const header = document.querySelector(".header-main-txt");
    const items = [...document.querySelectorAll(".wrp-feed-item")].map((item) => {
      const message = item.querySelector(".att-msg");
      if (!message) return { type: "event", text: clean(item) };
      const status = message.querySelector("[aria-label^='Entregue'], [aria-description^='Entregue']");
      const lines = clean(message).split("\n");
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
      items: (() => {
        const elements = [...document.querySelectorAll(".wrp-feed-item")];
        const kept = [];
        items.forEach((item, position) => {
          if (!(item.text || item.attachments)) return;
          elements[position]?.setAttribute("data-aspa-item", String(kept.length));
          kept.push({ index: kept.length, ...item });
        });
        return kept;
      })(),
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
  if (!clicked) fail(CODES.UI_CHANGED, `A ação "${iconName}" não foi encontrada no cabeçalho da conversa.`);
  await sleep(700);
}

async function clickComposerPlus(page, item) {
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "loupe" && !b.closest(".cdk-overlay-container"));
    if (!button) return false;
    button.click();
    return true;
  });
  if (!clicked) fail(CODES.UI_CHANGED, "Não achei o menu + da caixa de resposta.");
  await sleep(600);
  if (!(await clickOverlay(page, "button, [role=menuitem]", item))) fail(CODES.UI_CHANGED, `Não achei a opção "${item}" no menu + da caixa de resposta.`);
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
      const textOf = (element) => (window.__aspaText ? window.__aspaText(element) : element.innerText);
      return [...document.querySelectorAll(`.cdk-overlay-container :is(${sel})`)].map((e) =>
        textOf(e)
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !icon.test(l))
          .join(" "),
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
  const options = await page.evaluate(() => {
    const textOf = (element) => (window.__aspaText ? window.__aspaText(element) : element.innerText);
    return [...document.querySelectorAll(".cdk-overlay-container mat-option")].map(
      (option) =>
        textOf(option)
          .split("\n")
          .map((t) => t.trim())
          .find(Boolean) ?? "",
    );
  });
  const needle = wanted.toLowerCase();
  const exact = options.map((text, i) => ({ text, i })).filter((o) => o.text.toLowerCase() === needle);
  const partial = options.map((text, i) => ({ text, i })).filter((o) => o.text.toLowerCase().includes(needle));
  const picked = exact.length === 1 ? exact : partial;
  if (picked.length !== 1) {
    await closeOverlays(page);
    fail(
      picked.length ? CODES.AMBIGUOUS : CODES.NOT_FOUND,
      `${what} "${wanted}" ${picked.length ? "é ambíguo" : "não encontrado"}. Opções: ${options.join(" | ")}`,
    );
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
    fail(CODES.NOT_VERIFIED, "O painel não mostrou a mensagem nova em 30 s. Confira a conversa no Aspa antes de tentar de novo, para não enviar em dobro.");
  }
}

async function lastSentText(page) {
  return page.evaluate(() => {
    const sent = [...document.querySelectorAll(".att-msg-sent")].at(-1);
    if (!sent) return "";
    return (window.__aspaText ? window.__aspaText(sent) : sent.innerText).trim();
  });
}

function sentMatches(shown, text) {
  const a = comparable(shown);
  const b = comparable(text).slice(0, 60);
  return !!b && a.includes(b);
}

export const login = () =>
  exclusive(async () => {
    assertDisplay();
    interactive = "login";
    try {
      await closeBrowser();
      await ensureBrowser(true);
      const page = workPage;
      await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
      await page.bringToFront();
      const deadline = Date.now() + LOGIN_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (!browser?.connected || page.isClosed()) fail(CODES.WINDOW_CLOSED, "A janela de login foi fechada antes de concluir o login.");
        if ((await sessionState(page).catch(() => "loading")) === "logged_in") {
          await sleep(2000);
          return { loggedIn: true, profile: PROFILE_DIR };
        }
        await sleep(1000);
      }
      fail(CODES.TIMEOUT, "O login não foi concluído em 5 minutos. Chame aspa_login de novo.");
    } finally {
      interactive = null;
      await closeBrowser();
    }
  });

const LIST_FILTERS = {
  sem_usuario: "Sem usuário",
  sem_resposta: "Sem resposta",
  em_automacao: "Em automação",
  com_contexto: "Com contexto",
  sessao_ativa: "Sessão ativa",
  sem_sessao_ativa: "Sem sessão ativa",
};
const LIST_ORDER = { recentes: "Recentes primeiro", antigas: "Antigas primeiro" };

async function activeFilterChips(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        const text = b.innerText.trim();
        return b.offsetParent && r.x < 400 && r.y > 90 && r.y < 200 && /\(\d+\)/.test(text) && !/^(Todos|Meus|Pendentes) \(/.test(text);
      })
      .map((b) => b.innerText.trim()),
  );
}

async function clearListFilters(page) {
  for (let i = 0; i < 6; i++) {
    const chips = await activeFilterChips(page);
    if (!chips.length) return true;
    await page.evaluate((label) => {
      const chip = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === label);
      chip?.click();
    }, chips[0]);
    await sleep(1200);
  }
  return !(await activeFilterChips(page)).length;
}

async function clickListMenuItem(page, label) {
  const opened = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "filter_alt" && b.getBoundingClientRect().x < 400);
    if (!button) return false;
    button.click();
    return true;
  });
  if (!opened) fail(CODES.UI_CHANGED, "Não achei o menu de filtros da lista.");
  await sleep(600);
  const clicked = await page.evaluate((text) => {
    const item = [...document.querySelectorAll(".cdk-overlay-container :is(button, [role=menuitem])")].find(
      (b) => b.innerText.trim().replace(/^[a-z_]+\s+/, "") === text,
    );
    if (!item) return false;
    item.click();
    return true;
  }, label);
  if (!clicked) {
    await closeOverlays(page);
    fail(CODES.UI_CHANGED, `Não achei a opção "${label}" no menu da lista.`);
  }
  await sleep(1500);
  if (await page.$(".cdk-overlay-backdrop")) await closeOverlays(page);
}

export const listConversations = ({ tab, filters = [], order } = {}) =>
  exclusive(async () => {
    const page = await getWorkPage();
    await ensureList(page, tab);
    const baseline = (await readList(page)).length;
    const applied = [];
    try {
      for (const filter of filters) {
        const label = LIST_FILTERS[filter];
        if (!label) fail(CODES.INVALID_INPUT, `Filtro desconhecido "${filter}". Use ${Object.keys(LIST_FILTERS).join(", ")}.`);
        await clickListMenuItem(page, label);
        applied.push(label);
      }
      if (order && order !== "recentes") {
        if (!LIST_ORDER[order]) fail(CODES.INVALID_INPUT, 'Ordem desconhecida. Use "recentes" ou "antigas".');
        await clickListMenuItem(page, LIST_ORDER[order]);
      }
      const tabs = await page.evaluate(() =>
        [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter((t) => /^(Todos|Meus|Pendentes) \(\d+\)$/.test(t)),
      );
      return { tabs, filters: applied.length ? applied : undefined, order: order ? LIST_ORDER[order] : undefined, conversations: await readList(page) };
    } finally {
      if (order && order !== "recentes") await clickListMenuItem(page, LIST_ORDER.recentes).catch(() => null);
      if (applied.length && !(await clearListFilters(page))) console.error("[list] could not remove list filters");
      const restored = (await readList(page)).length;
      if (applied.length && restored !== baseline) console.error(`[list] list size changed after removing filters (${baseline} -> ${restored})`);
    }
  });

export const readConversation = ({ index, contact, loadMoreTimes = 0, keepUnread = false } = {}) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    if (loadMoreTimes > 0) await loadMore(page, loadMoreTimes);
    const feed = { conversation_id: match.conversation_id, ...(await readFeed(page)) };
    if (keepUnread && match.unread) feed.kept_unread = await markUnreadInList(page, match.contact).catch(() => false);
    return feed;
  });

export const sendMessage = ({ index, contact, conversation_id, text }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    const verified = await fillAndSend(page, text, match);
    return { sent: true, contact: match.contact, conversation_id: match.conversation_id, verified };
  });

async function fillAndSend(page, text, match) {
    await assertStillOn(page, match);
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
    if (state === "busy") fail(CODES.INVALID_INPUT, "A caixa de resposta já tem texto no painel. Limpe-a antes de enviar.");
    if (state !== "ok") fail(CODES.FORBIDDEN, "A caixa de resposta não está disponível. A janela de 24 h pode estar fechada; use aspa_send_template.");
    await sleep(400);
    await assertStillOn(page, match);
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
      fail(CODES.FORBIDDEN, "O botão de enviar não está disponível. A janela de 24 h pode estar fechada; use aspa_send_template.");
    }
    await waitSentIncrease(page, before);
    for (let i = 0; i < 20; i++) {
      if (sentMatches(await lastSentText(page), text)) return true;
      await sleep(500);
    }
    return false;
}

export const listTemplates = ({ index, contact }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    await openConversation(page, { index, contact });
    await clickComposerPlus(page, "Mensagem Modelo");
    await page.waitForSelector(".cdk-overlay-container mat-option", { timeout: 10000 }).catch(() => null);
    const templates = await page.evaluate(() => {
      const textOf = (element) => (window.__aspaText ? window.__aspaText(element) : element.innerText);
      return [...document.querySelectorAll(".cdk-overlay-container mat-option")].map((option) => {
        const lines = textOf(option)
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean);
        if (lines.length >= 2) return { name: lines[0], preview: lines.slice(1).join(" ") };
        const leaves = [...option.querySelectorAll("*")]
          .filter((e) => e.childElementCount === 0 && !e.closest("mat-icon") && e.innerText?.trim())
          .map((e) => e.innerText.trim());
        return { name: leaves[0] ?? "", preview: leaves.slice(1).join(" ") };
      });
    });
    await closeOverlays(page);
    return { templates };
  });

export const sendTemplate = ({ index, contact, conversation_id, template, variables = [] }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
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
      fail(CODES.INVALID_INPUT, `O template "${template}" pede ${editable.length} variável(is); recebi ${variables.length}.`);
    }
    for (const [i, field] of editable.entries()) {
      await field.click({ clickCount: 3 });
      await field.type(String(variables[i]));
    }
    try {
      await assertStillOn(page, match);
    } catch (error) {
      await closeOverlays(page);
      throw error;
    }
    if (!(await clickOverlay(page, "button", "Enviar$"))) {
      await closeOverlays(page);
      fail(CODES.UI_CHANGED, "Não achei o botão Enviar na janela do template. Nada foi enviado.");
    }
    await waitDialogClosed(page);
    await waitSentIncrease(page, before);
    return { sent: true, contact: match.contact, conversation_id: match.conversation_id, template };
  });

export const ATTACHMENT_ROOTS = () => [homedir(), "/tmp", CACHE_DIR];

export function checkAttachmentPath(path) {
  if (typeof path !== "string" || !path.startsWith("/")) fail(CODES.INVALID_INPUT, "Informe o caminho absoluto do arquivo.");
  if (!existsSync(path)) fail(CODES.NOT_FOUND, `Arquivo não encontrado: ${path}`);
  const real = realpathSync(path);
  if (!statSync(real).isFile()) fail(CODES.INVALID_INPUT, "O caminho não é um arquivo.");
  const cache = existsSync(CACHE_DIR) ? realpathSync(CACHE_DIR) : CACHE_DIR;
  const inCache = real.startsWith(cache + sep);
  const root = ATTACHMENT_ROOTS()
    .slice(0, 2)
    .map((r) => (existsSync(r) ? realpathSync(r) : r))
    .find((r) => real.startsWith(r + sep));
  const hidden = root && relative(root, real).split(sep).some((part) => part.startsWith("."));
  if (!inCache && (!root || hidden)) {
    fail(
      CODES.FORBIDDEN,
      "Por segurança, só envio arquivos da sua pasta pessoal (fora de pastas ocultas como ~/.config e ~/.ssh), de /tmp ou anexos baixados pelo aspa-mcp.",
    );
  }
  if (statSync(real).size > MAX_ATTACHMENT_BYTES) fail(CODES.INVALID_INPUT, "O arquivo passa de 16 MB.");
  return real;
}

export const sendAttachment = ({ index, contact, conversation_id, path, caption }) =>
  exclusive(async () => {
    const file = checkAttachmentPath(path);
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    const before = await countSent(page);
    await clickComposerPlus(page, "Inserir Anexo");
    const input = await page.waitForSelector(".cdk-overlay-container input[type=file]", { timeout: 10000 });
    await input.uploadFile(file);
    await sleep(1500);
    try {
      await assertStillOn(page, match);
    } catch (error) {
      await closeOverlays(page);
      throw error;
    }
    if (!(await clickOverlay(page, "button", "^Confirmar$"))) {
      await closeOverlays(page);
      fail(CODES.UI_CHANGED, "Não achei o botão Confirmar na janela do anexo. Nada foi enviado.");
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
      fail(CODES.UI_CHANGED, `Não achei o passo de envio depois de confirmar o anexo. Botões da janela: ${buttons.join(" | ") || "nenhum"}`);
    }
    await waitSentIncrease(page, before);
    return { sent: true, contact: match.contact, conversation_id: match.conversation_id, file: basename(file), path: file };
  });

async function assumeButton(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Assumir" && b.offsetParent && !b.closest(".cdk-overlay-container")),
  );
}

export const assume = ({ index, contact, conversation_id }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    if (!(await assumeButton(page))) {
      const hasBox = await page.evaluate(() => !!document.querySelector("textarea.cdk-textarea-autosize"));
      return { assumed: false, contact: match.contact, verified: false, note: hasBox ? "A conversa já é sua." : "Botão Assumir não encontrado." };
    }
    await assertStillOn(page, match);
    await page.evaluate(() =>
      [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Assumir" && b.offsetParent && !b.closest(".cdk-overlay-container")).click(),
    );
    await sleep(1500);
    if (await dialogOpen(page)) await clickOverlay(page, "button", "^(Assumir|Confirmar|Sim)$");
    const verified = await page
      .waitForFunction(() => !!document.querySelector("textarea.cdk-textarea-autosize"), { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    return { assumed: verified, contact: match.contact, verified };
  });

export const transfer = ({ index, contact, conversation_id, to, comment }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    await clickHeaderIcon(page, "swap_horiz");
    const input = await page
      .waitForSelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) input", { timeout: 10000 })
      .catch(() => null);
    if (!input) {
      if (await assumeButton(page)) {
        fail(CODES.FORBIDDEN, "O Aspa não abriu a transferência desta conversa. Assuma a conversa primeiro com aspa_assume (vale para conversas sem atendente e de outro atendente).");
      }
      fail(CODES.UI_CHANGED, "A janela de transferência não abriu no painel do Aspa.");
    }
    await input.click();
    await page.waitForSelector(".cdk-overlay-container mat-option", { timeout: 8000 }).catch(() => null);
    const available = await overlayTexts(page, "mat-option");
    if (!available.length) {
      await input.type(to);
      const visible = await page
        .waitForSelector(".cdk-overlay-container mat-option", { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!visible) {
        await closeOverlays(page);
        fail(CODES.NOT_FOUND, `Nenhum destino de transferência corresponde a "${to}".`);
      }
    }
    const chosen = await chooseOption(page, to, "Destination");
    if (comment) {
      const field = await page.$(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) textarea");
      if (field) await field.type(comment);
    }
    try {
      await assertStillOn(page, match);
    } catch (error) {
      await closeOverlays(page);
      throw error;
    }
    if (!(await clickOverlay(page, "button", "Transferir$"))) {
      await closeOverlays(page);
      fail(CODES.UI_CHANGED, "Não achei o botão Transferir na janela. Nada foi transferido.");
    }
    await waitDialogClosed(page);
    return { transferred: true, contact: match.contact, to: chosen };
  });

export const snooze = ({ index, contact, conversation_id, duration }) =>
  exclusive(async () => {
    const label = SNOOZE_LABELS[duration];
    if (!label) fail(CODES.INVALID_INPUT, `Duração inválida "${duration}". Use 1h, 1d ou 1w.`);
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    await assertStillOn(page, match);
    await clickHeaderIcon(page, "alarm");
    if (!(await clickOverlay(page, "button, [role=menuitem]", `^${label}$`))) {
      await closeOverlays(page);
      fail(CODES.UI_CHANGED, `Não achei a opção de adiamento "${label}".`);
    }
    await sleep(1500);
    if (await dialogOpen(page)) await clickOverlay(page, "button", "^(Confirmar|Adiar|Sim)$");
    await sleep(2000);
    await ensureList(page, null);
    const stillOpen = (await readList(page)).some((item) => item.contact === match.contact);
    return { snoozed: !stillOpen, contact: match.contact, duration: label, verified: !stillOpen };
  });

export const conclude = ({ index, contact, conversation_id }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    await assertStillOn(page, match);
    await clickHeaderIcon(page, "task_alt");
    await sleep(1200);
    if (await dialogOpen(page)) {
      if (!(await clickOverlay(page, "button", "(Concluir|Confirmar|Sim)$"))) {
        const buttons = await overlayTexts(page, "button");
        await closeOverlays(page);
        fail(CODES.UI_CHANGED, `A janela de concluir veio diferente do esperado. Botões: ${buttons.join(" | ")}`);
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
    if (!match) fail(CODES.NOT_FOUND, `Nenhuma conversa concluída corresponde a "${contact}" na primeira página de Atendimentos Concluídos (última semana).`);
    await page.evaluate((i) => document.querySelectorAll("tr.mat-mdc-row")[i].querySelector("td").click(), match.index);
    await page.waitForSelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container)", { timeout: 15000 });
    await sleep(1000);
    if (!(await clickOverlay(page, "button", "^open_in_new$"))) {
      const buttons = await overlayTexts(page, "button");
      await closeOverlays(page);
      fail(CODES.UI_CHANGED, `Não achei o botão de abrir a conversa na prévia. Botões: ${buttons.join(" | ")}`);
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
    if (!started) fail(CODES.UI_CHANGED, "Não achei o botão Iniciar na conversa concluída.");
    await sleep(3000);
    if (await dialogOpen(page)) await clickOverlay(page, "button", "(Iniciar|Confirmar|Sim)$");
    await sleep(2000);
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    await ensureList(page, null);
    const reopened = (await readList(page)).some((item) => item.contact.toLowerCase().includes(match.contact.toLowerCase()));
    return { reopened, contact: match.contact, verified: reopened };
  });

export const renameContact = ({ index, contact, conversation_id, name }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    const opened = await page.evaluate(() => {
      const pencil = [...document.querySelectorAll("mat-icon, button")].find((e) => e.innerText.trim() === "edit" && e.getBoundingClientRect().x > 1000);
      if (!pencil) return false;
      (pencil.closest("button") ?? pencil).click();
      return true;
    });
    if (!opened) fail(CODES.UI_CHANGED, "Não achei o lápis de editar o contato. O painel do contato pode estar fechado.");
    await sleep(600);
    const field = await page.evaluateHandle(() =>
      [...document.querySelectorAll("input")].find((e) => e.getBoundingClientRect().x > 1000 && !e.readOnly && !e.disabled),
    );
    const input = field.asElement();
    if (!input) fail(CODES.UI_CHANGED, "Não achei o campo de nome do contato.");
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
      fail(CODES.UI_CHANGED, "Não consegui digitar o novo nome; o campo foi restaurado sem salvar.");
    }
    try {
      await assertStillOn(page, match);
    } catch (error) {
      await input.evaluate((e, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(e, value);
        e.dispatchEvent(new Event("input", { bubbles: true }));
      }, previous);
      throw error;
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

const DEGRADED_AFTER_MS = 5 * 60 * 1000;

async function diagnose(page) {
  return page
    .evaluate(() => ({
      url: location.href,
      title: document.title,
      list_items: document.querySelectorAll("button.list-otps-btn").length,
      tabs: [...document.querySelectorAll("button")].filter((b) => /^(Todos|Meus|Pendentes) \(/.test(b.innerText.trim())).length,
    }))
    .catch((error) => ({ error: error.message }));
}

export function isActivity(previous, item) {
  if (!previous) return true;
  if (item.unread && !previous.unread) return true;
  return previous.time !== item.time && /^\d{1,2}:\d{2}$/.test(item.time);
}

export function startWatcher({ intervalMs, tabs = ["meus"], onActivity, onSessionLost, onDegraded, onRecovered }) {
  let known = null;
  let lastReload = 0;
  let sessionLost = false;
  let inFlight = false;
  let lastLoggedError = "";
  watcherHealth.lastTickOkAt = Date.now();
  const failed = async (reason, page) => {
    watcherHealth.consecutiveFailures += 1;
    watcherHealth.lastError = reason;
    if (reason !== lastLoggedError) console.error(`[watch] ${reason}`);
    lastLoggedError = reason;
    if (!watcherHealth.degraded && Date.now() - watcherHealth.lastTickOkAt > DEGRADED_AFTER_MS) {
      watcherHealth.degraded = true;
      onDegraded?.({ reason, diagnosis: page ? await diagnose(page) : undefined });
    }
  };
  const succeeded = () => {
    if (watcherHealth.degraded) onRecovered?.();
    watcherHealth.degraded = false;
    watcherHealth.consecutiveFailures = 0;
    watcherHealth.lastError = null;
    watcherHealth.lastTickOkAt = Date.now();
    lastLoggedError = "";
  };
  const tick = () =>
    exclusive(async () => {
      if (interactive) return;
      const page = await getWatchPage();
      if (Date.now() - lastReload > WATCH_RELOAD_MS || page.url() !== LIST_URL) {
        await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
        lastReload = Date.now();
      }
      const state = await waitForSession(page, 30000);
      if (state === "logged_out") {
        if (!sessionLost) onSessionLost();
        sessionLost = true;
        watcherHealth.lastTickOkAt = Date.now();
        return;
      }
      sessionLost = false;
      if (state !== "logged_in") return failed("o painel não terminou de carregar", page);
      await page.waitForFunction(() => document.querySelectorAll("button.list-otps-btn").length > 0, { timeout: 30000 }).catch(() => null);
      if (!(await panelLoaded(page))) return failed("a lista de conversas não apareceu", page);
      if ((await activeFilterChips(page)).length) await clearListFilters(page);
      const next = new Map();
      for (const tab of typeof tabs === "function" ? tabs() : tabs) {
        if (!(await selectTab(page, tab))) return failed(`a aba "${tab}" não foi encontrada`, page);
        for (const item of await readList(page)) next.set(item.contact, item);
      }
      if (known) {
        for (const item of next.values()) {
          const previous = known.get(item.contact);
          if (isActivity(previous, item)) onActivity(item, { isNew: !previous });
        }
      }
      known = next;
      succeeded();
    });
  const run = () => {
    if (interactive) watcherHealth.lastTickOkAt = Date.now();
    if (inFlight || interactive) return;
    inFlight = true;
    tick()
      .catch((error) => failed(error.message))
      .finally(() => {
        inFlight = false;
      });
  };
  run();
  return setInterval(run, intervalMs);
}


async function markUnreadInList(page, contactName) {
  await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
  await ensureList(page, null);
  const item = (await readList(page)).find((i) => i.contact === contactName);
  if (!item) fail(CODES.NOT_FOUND, `A conversa "${contactName}" não está na lista de abertas.`);
  const handle = (await page.$$("button.list-otps-btn"))[item.index];
  const box = await handle.boundingBox();
  await page.mouse.click(box.x + 60, box.y + 18, { button: "right" });
  await sleep(700);
  if (!(await clickOverlay(page, "button, [role=menuitem]", "Marcar como não lida$"))) {
    await closeOverlays(page);
    fail(CODES.UI_CHANGED, "Não achei a opção Marcar como não lida.");
  }
  for (let i = 0; i < 8; i++) {
    await sleep(800);
    if ((await readList(page)).find((x) => x.contact === contactName)?.unread) return true;
  }
  return false;
}

export const markUnread = ({ index, contact }) =>
  exclusive(async () => {
    if (!String(contact ?? "").trim()) fail(CODES.INVALID_INPUT, "Informe o nome do contato (contact).");
    const page = await getWorkPage();
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    await ensureList(page, null);
    const match = pickConversation(await readList(page), { index, contact });
    if (!match) fail(CODES.NOT_FOUND, "Conversa não encontrada na lista de conversas abertas.");
    const verified = await markUnreadInList(page, match.contact);
    return { marked_unread: verified, contact: match.contact, verified };
  });

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const searchConversation = ({ index, contact, query, loadMoreTimes = 3 }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    await openConversation(page, { index, contact });
    if (loadMoreTimes > 0) await loadMore(page, loadMoreTimes);
    const feed = await readFeed(page);
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    const matches = feed.items.filter((item) => terms.every((term) => normalizeText(item.text).includes(term)));
    return { contact: feed.contact, query, searched_items: feed.items.length, matches };
  });

export const replyToMessage = ({ index, contact, conversation_id, messageIndex, text, loadMoreTimes = 0 }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    if (loadMoreTimes > 0) await loadMore(page, loadMoreTimes);
    const feed = await readFeed(page);
    const target = feed.items.find((item) => item.index === messageIndex);
    if (!target || target.type !== "message") fail(CODES.NOT_FOUND, `Mensagem ${messageIndex} não encontrada. Leia a conversa de novo e use o índice dela.`);
    const quoted = await page.evaluate((i) => {
      const icon = [...document.querySelectorAll(`[data-aspa-item="${i}"] mat-icon`)].find((e) => e.innerText.trim() === "reply");
      if (!icon) return false;
      icon.click();
      return true;
    }, messageIndex);
    if (!quoted) fail(CODES.UI_CHANGED, "Não achei o botão de responder nessa mensagem.");
    await sleep(800);
    const verified = await fillAndSend(page, text, match);
    return { sent: true, contact: match.contact, conversation_id: match.conversation_id, verified, replied_to: { index: messageIndex, text: target.text?.slice(0, 120) } };
  });

async function pickCalendarDate(page, isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  await page.evaluate(() => document.querySelector(".cdk-overlay-container input[readonly]")?.click());
  await page.waitForSelector(".cdk-overlay-container mat-calendar, .mat-datepicker-content", { timeout: 8000 });
  for (let i = 0; i < 24; i++) {
    const label = await page.evaluate(() => document.querySelector(".mat-calendar-period-button")?.innerText.trim() ?? "");
    const shown = label.match(/(\d{4})/)?.[1];
    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const shownMonth = months.findIndex((m) => normalizeText(label).startsWith(m)) + 1;
    if (!shown || !shownMonth) fail(CODES.UI_CHANGED, `Cabeçalho inesperado no calendário: "${label}".`);
    const diff = (year - Number(shown)) * 12 + (month - shownMonth);
    if (diff === 0) break;
    await page.click(diff > 0 ? ".mat-calendar-next-button" : ".mat-calendar-previous-button");
    await sleep(300);
  }
  const clicked = await page.evaluate((d) => {
    const cell = [...document.querySelectorAll(".mat-calendar-body-cell")].find(
      (c) => c.innerText.trim() === String(d) && !c.classList.contains("mat-calendar-body-disabled") && c.getAttribute("aria-disabled") !== "true",
    );
    if (!cell) return false;
    cell.click();
    return true;
  }, day);
  if (!clicked) fail(CODES.INVALID_INPUT, `A data ${isoDate} não está disponível no calendário (datas passadas ficam bloqueadas).`);
  await sleep(600);
}

export const snoozeUntil = ({ index, contact, conversation_id, date, time, comment }) =>
  exclusive(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) fail(CODES.INVALID_INPUT, "A data precisa estar no formato AAAA-MM-DD.");
    if (!/^([01]\d|2[0-3]):(00|15|30|45)$/.test(time ?? "")) fail(CODES.INVALID_INPUT, "O horário precisa ser HH:MM em passos de 15 minutos (ex.: 14:30).");
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    await clickHeaderIcon(page, "alarm");
    if (!(await clickOverlay(page, "button, [role=menuitem]", "Escolher data"))) {
      await closeOverlays(page);
      fail(CODES.UI_CHANGED, "Não achei a opção Escolher data no menu de adiar.");
    }
    await page.waitForSelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container)", { timeout: 8000 });
    try {
      await pickCalendarDate(page, date);
      await page.evaluate(() => document.querySelectorAll(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) mat-select")[0]?.click());
      await page.waitForSelector(".cdk-overlay-container mat-option", { timeout: 5000 });
      const pickedTime = await page.evaluate((t) => {
        const option = [...document.querySelectorAll(".cdk-overlay-container mat-option")].find((o) => o.innerText.trim() === t);
        if (!option) return false;
        option.click();
        return true;
      }, time);
      if (!pickedTime) fail(CODES.INVALID_INPUT, `O horário ${time} não está disponível.`);
      await sleep(500);
      if (comment) {
        const field = await page.$(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) textarea");
        if (field) await field.type(comment);
      }
      const shown = await page.evaluate(() => document.querySelector(".cdk-overlay-container input[readonly]")?.value ?? "");
      await assertStillOn(page, match);
      if (!(await clickOverlay(page, "button", "^Adiar$"))) fail(CODES.UI_CHANGED, "Não achei o botão de confirmar o adiamento.");
      await waitDialogClosed(page).catch(() => null);
      await sleep(2000);
      await ensureList(page, null);
      const stillOpen = (await readList(page)).some((item) => item.contact === match.contact);
      return { snoozed: !stillOpen, contact: match.contact, until: `${date} ${time}`, panel_date: shown, verified: !stillOpen };
    } catch (error) {
      await closeOverlays(page);
      throw error;
    }
  });

async function goToSection(page, buttonLabel, readySelectorOrText) {
  await ensureList(page, null);
  await page.evaluate((label) => [...document.querySelectorAll("button")].find((b) => b.innerText.includes(label))?.click(), buttonLabel);
  if (readySelectorOrText.startsWith("text:")) {
    const text = readySelectorOrText.slice(5);
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 30000 }, text);
  } else {
    await page.waitForSelector(readySelectorOrText, { timeout: 30000 });
  }
  await sleep(1500);
}

export const statistics = () =>
  exclusive(async () => {
    const page = await getWorkPage();
    await goToSection(page, "Painel de Estatísticas", "text:Atendimentos Hoje");
    await sleep(1500);
    const data = await page.evaluate(() => {
      const lines = document.body.innerText.split("\n").map((l) => l.trim()).filter(Boolean);
      const counters = {};
      for (const label of ["Atendimentos Hoje", "Atendimentos Ativos", "Atendimentos Concluídos", "Atendimentos Sem Resposta", "Atendimentos Adiados"]) {
        const i = lines.indexOf(label);
        if (i >= 0) counters[label] = lines.slice(i + 1, i + 4).find((l) => /^(\d+|-)$/.test(l)) ?? null;
      }
      const agents = [...document.querySelectorAll("tr")]
        .map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.trim()))
        .filter((cells) => cells.length >= 3)
        .map(([nome, sem_resposta, ativos]) => ({ nome, sem_resposta, ativos }));
      const tags = lines.includes("Sem Etiquetas em Uso") ? [] : undefined;
      return { counters, agents, tags };
    });
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    return data;
  });

export const quickReplies = () =>
  exclusive(async () => {
    const page = await getWorkPage();
    await goToSection(page, "Respostas Rápidas", "text:Tenha mensagens prontas");
    const data = await page.evaluate(() => ({
      empty: document.body.innerText.includes("Nenhum Modelo Encontrado"),
      items: [...document.querySelectorAll("tr.mat-mdc-row, tr.cdk-row")].map((tr) => {
        const cells = [...tr.querySelectorAll("td")].map((td) => td.innerText.trim());
        return { nome: cells[0], grupo: cells[1], detalhes: cells.slice(2).filter(Boolean) };
      }),
    }));
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    return data;
  });

export const listConcluded = ({ query, pageNumber = 1 } = {}) =>
  exclusive(async () => {
    const page = await getWorkPage();
    await goToSection(page, "Atendimentos Concluídos", "tr.mat-mdc-row");
    if (query) {
      const input = await page.evaluateHandle(() =>
        [...document.querySelectorAll("input")].find((i) => i.offsetParent && /nome|pesquisar/i.test(`${i.placeholder} ${i.getAttribute("aria-label") ?? ""} ${i.closest(".mat-mdc-form-field")?.innerText ?? ""}`)),
      );
      if (!input.asElement()) fail(CODES.UI_CHANGED, "Não achei o campo de busca nos atendimentos concluídos.");
      await input.asElement().click();
      await input.asElement().type(query);
      await page.keyboard.press("Enter");
      await sleep(3000);
    }
    for (let i = 1; i < pageNumber; i++) {
      const moved = await page.evaluate(() => {
        const next = document.querySelector(".mat-mdc-paginator-navigation-next");
        if (!next || next.disabled) return false;
        next.click();
        return true;
      });
      if (!moved) break;
      await sleep(1200);
    }
    const data = await page.evaluate(() => ({
      periodo: [...document.querySelectorAll("*")].find((e) => e.childElementCount === 0 && /Mostrando/.test(e.textContent))?.textContent.trim(),
      paginacao: document.querySelector(".mat-mdc-paginator-range-label")?.innerText.trim(),
      conversas: [...document.querySelectorAll("tr.mat-mdc-row")].map((tr) => {
        const cells = [...tr.querySelectorAll("td")].map((td) => (window.__aspaText ? window.__aspaText(td) : td.innerText).trim());
        return { contato: cells[0]?.split("\n")[0], detalhe: cells[0]?.split("\n").slice(1).join(" ") || undefined, status: cells[1], usuario: cells[2], atualizado: cells[3] };
      }),
    }));
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    return data;
  });

async function openContactsMenuItem(page, label) {
  await ensureList(page, null);
  const opened = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "more_vert" && b.getBoundingClientRect().x < 400);
    if (!button) return false;
    button.click();
    return true;
  });
  if (!opened) fail(CODES.UI_CHANGED, "Não achei o menu de contatos.");
  await sleep(600);
  if (!(await clickOverlay(page, "button, [role=menuitem]", label))) {
    await closeOverlays(page);
    fail(CODES.UI_CHANGED, `Não achei a opção "${label}" no menu de contatos.`);
  }
  await page.waitForSelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container)", { timeout: 8000 });
  await sleep(600);
}

export const searchContact = ({ query }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    return searchContactIn(page, query);
  });

async function searchContactIn(page, query) {
    await openContactsMenuItem(page, "Buscar contato");
    try {
      const input = await page.$(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) input[type=text]");
      if (!input) fail(CODES.UI_CHANGED, "Não achei o campo de busca de contatos.");
      await input.type(query);
      if (!(await clickOverlay(page, "button", "^Buscar$"))) fail(CODES.UI_CHANGED, "Não achei o botão Buscar.");
      await sleep(3500);
      return await page.evaluate((iconPattern) => {
        const icon = new RegExp(iconPattern);
        const dialog = document.querySelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container)");
        const text = dialog ? (window.__aspaText ? window.__aspaText(dialog) : dialog.innerText) : "";
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !icon.test(l) && !/^(Modo de busca|Nome ou telefone|Cancelar|Buscar|Buscar contato|Localizar|Contatos)$/.test(l));
        return { resultados: lines };
      }, ICON_LINE.source);
    } finally {
      await closeOverlays(page);
    }
}

const digitsOf = (value) => String(value ?? "").replace(/\D/g, "");

export const createContact = ({ name, phone }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const localDigits = digitsOf(phone).replace(/^55/, "");
    const existing = await searchContactIn(page, localDigits);
    const existingPhone = existing.resultados.find((line) => digitsOf(line).endsWith(localDigits.slice(-8)));
    if (existingPhone) {
      const index = existing.resultados.indexOf(existingPhone);
      const existingName = existing.resultados.find((line, i) => i < index && /[a-zA-ZÀ-ú]/.test(line) && !line.startsWith("·"));
      fail(CODES.DUPLICATE, `Já existe um contato com esse telefone${existingName ? ` ("${existingName}")` : ""}. Nada foi criado.`);
    }
    await openContactsMenuItem(page, "Novo contato");
    try {
      const inputs = await page.$$(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) input[type=text], .cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container) input[type=tel]");
      if (inputs.length < 2) fail(CODES.UI_CHANGED, "Não achei os campos de novo contato.");
      await inputs[0].type(name);
      await inputs[1].type(phone);
      if (!(await clickOverlay(page, "button", "^Criar contato$"))) fail(CODES.UI_CHANGED, "Não achei o botão Criar contato.");
      const closed = await waitDialogClosed(page, 15000).then(() => true).catch(() => false);
      if (!closed) {
        const message = await page.evaluate(() => document.querySelector(".cdk-overlay-container :is(mat-error, .mat-mdc-form-field-error, simple-snack-bar)")?.innerText.trim());
        fail(CODES.NOT_VERIFIED, `O Aspa não confirmou o novo contato${message ? `: ${message}` : "."}`);
      }
      await sleep(1500);
      const check = await searchContactIn(page, name);
      const found = check.resultados.some((line) => line.toLowerCase() === name.toLowerCase());
      return { created: found, name, phone, verified: found, note: found ? undefined : "The dialog closed but the contact was not found by name afterwards." };
    } catch (error) {
      await closeOverlays(page);
      throw error;
    }
  });

export const setPromotionsBlocked = ({ index, contact, conversation_id, blocked }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    const state = () =>
      page.evaluate(() => {
        const toggle = [...document.querySelectorAll("mat-slide-toggle")].find((t) => t.innerText.includes("Bloquear Promoções"));
        const control = toggle?.querySelector("button[role=switch], input[type=checkbox]");
        if (!control) return null;
        return control.getAttribute("aria-checked") === "true" || control.checked === true;
      });
    const current = await state();
    if (current === null) fail(CODES.UI_CHANGED, "Não achei a chave Bloquear Promoções no painel do contato.");
    let dialog;
    if (current !== blocked) {
      await assertStillOn(page, match);
      await page.evaluate(() => {
        const toggle = [...document.querySelectorAll("mat-slide-toggle")].find((t) => t.innerText.includes("Bloquear Promoções"));
        toggle.querySelector("button[role=switch], input[type=checkbox]").click();
      });
      await sleep(1200);
      if (await dialogOpen(page)) {
        dialog = await overlayTexts(page, "h2, p, button");
        await clickOverlay(page, "button", "^(Confirmar|Sim|Desbloquear|Bloquear|Continuar|OK)$");
        await sleep(1200);
      }
    }
    let now = await state();
    for (let i = 0; i < 5 && now !== blocked; i++) {
      await sleep(800);
      now = await state();
    }
    return { promotions_blocked: now, contact: match.contact, changed: current !== now, verified: now === blocked, dialog };
  });

export const sessionStatus = () =>
  exclusive(async () => {
    const page = await getWorkPage();
    if (!page.url().startsWith(APP_ORIGIN)) await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    return { session: await waitForSession(page, 30000) };
  });

const REVIEW_TIMEOUT_MS = 20 * 60 * 1000;

export function openDraft({ index, contact, conversation_id, text, timeoutMinutes }, { onClosed } = {}) {
  let reportOpened;
  const opened = new Promise((resolve) => (reportOpened = resolve));
  exclusive(async () => {
    assertDisplay();
    interactive = "review";
    const limit = timeoutMinutes ? Math.min(Math.max(Number(timeoutMinutes), 1), 60) * 60000 : REVIEW_TIMEOUT_MS;
    let match = null;
    let baseline = 0;
    let lastSent = 0;
    try {
      await closeBrowser();
      await ensureBrowser(true);
      const page = workPage;
      match = await openConversation(page, { index, contact, conversation_id }, { write: true });
      if (await assumeButton(page)) fail(CODES.FORBIDDEN, "Esta conversa não é sua. Assuma a conversa (aspa_assume) antes de abrir um rascunho.");
      const filled = await page.evaluate((value) => {
        const box = document.querySelector("textarea.cdk-textarea-autosize");
        if (!box) return false;
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, value);
        box.dispatchEvent(new Event("input", { bubbles: true }));
        box.focus();
        return true;
      }, text);
      if (!filled) fail(CODES.FORBIDDEN, "A caixa de resposta não está disponível. A janela de 24 h pode estar fechada; use um template.");
      baseline = await countSent(page);
      lastSent = baseline;
      await page.bringToFront();
      reportOpened({ opened: true, contact: match.contact, window_minutes: limit / 60000 });
      const deadline = Date.now() + limit;
      let reason = "timeout";
      while (Date.now() < deadline) {
        if (!browser?.connected || page.isClosed()) {
          reason = "closed_by_user";
          break;
        }
        lastSent = await countSent(page).catch(() => lastSent);
        await sleep(2000);
      }
      onClosed?.({ contact: match.contact, sent_by_user: lastSent > baseline, messages_sent: Math.max(0, lastSent - baseline), reason });
    } catch (error) {
      reportOpened({ error });
      if (match) onClosed?.({ contact: match.contact, sent_by_user: lastSent > baseline, messages_sent: Math.max(0, lastSent - baseline), reason: "error" });
    } finally {
      interactive = null;
      await closeBrowser().catch(() => null);
    }
  }).catch((error) => reportOpened({ error }));
  return opened.then((result) => {
    if (result.error) throw result.error;
    return result;
  });
}

export async function shutdown() {
  await closeBrowser().catch(() => {});
}
