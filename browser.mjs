import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { loadConfig } from "./config.mjs";
import { AspaError, CODES, fail } from "./errors.mjs";

const CHROME_ENV_KEYS = ["PATH", "HOME", "USER", "LANG", "LC_ALL", "DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"];

export function chromeEnv() {
  let timeZone;
  try {
    timeZone = loadConfig().config.notificacoes.fuso;
  } catch {}
  const env = Object.fromEntries(CHROME_ENV_KEYS.filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  if (timeZone || process.env.TZ) env.TZ = timeZone || process.env.TZ;
  return env;
}

export const DATA_DIR = join(homedir(), ".local", "share", "aspa-mcp");

export const PROFILE_DIR = process.env.ASPA_PROFILE_DIR || join(DATA_DIR, "profile");

export const CACHE_DIR = process.env.ASPA_CACHE_DIR || join(homedir(), ".cache", "aspa-mcp");

const CHROME_CANDIDATES = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium"];

export const CHROME_PATH = process.env.ASPA_CHROME_PATH || CHROME_CANDIDATES.find((path) => existsSync(path)) || CHROME_CANDIDATES[0];

export const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

export let browser = null;

export let workPage = null;

export let watchPage = null;

export let visible = false;

export let chromeProcess = null;

export let queue = Promise.resolve();

export let queued = 0;

export let interactive = null;

export let launchFailures = 0;

export const requestContext = new AsyncLocalStorage();

export const watcherHealth = { lastTickOkAt: null, consecutiveFailures: 0, lastError: null, degraded: false };

export const interactiveMode = () => interactive;

export const withRequest = (signal, fn) => requestContext.run({ signal }, fn);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function exclusive(fn) {
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

export function pruneAttachments(days) {
  const folder = join(CACHE_DIR, "attachments");
  if (!existsSync(folder) || !(days > 0)) return 0;
  const limit = Date.now() - days * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const entry of readdirSync(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath ?? entry.path, entry.name);
    try {
      if (statSync(path).mtimeMs < limit) {
        rmSync(path, { force: true });
        removed += 1;
      }
    } catch {}
  }
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory() && !readdirSync(join(folder, entry.name)).length) rmSync(join(folder, entry.name), { recursive: true, force: true });
  }
  return removed;
}

export function processTreeRssMb(rootPid) {
  if (!rootPid) return 0;
  const children = new Map();
  const rss = new Map();
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const status = readFileSync(`/proc/${name}/status`, "utf8");
      const ppid = Number(status.match(/^PPid:\s+(\d+)/m)?.[1]);
      rss.set(Number(name), Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0));
      if (!children.has(ppid)) children.set(ppid, []);
      children.get(ppid).push(Number(name));
    } catch {}
  }
  let total = 0;
  const stack = [rootPid];
  while (stack.length) {
    const pid = stack.pop();
    total += rss.get(pid) ?? 0;
    stack.push(...(children.get(pid) ?? []));
  }
  return Math.round(total / 1024);
}

export function recycleChromeIfHeavy(limitMb) {
  if (interactive || queued > 0 || !browser?.connected || visible) return null;
  const used = processTreeRssMb(chromeProcess?.pid);
  if (used <= limitMb) return null;
  return exclusive(async () => {
    if (interactive) return null;
    console.error(`[chrome] recycling after reaching ${used} MB`);
    await closeBrowser();
    return used;
  });
}

export function health() {
  return {
    chrome: { connected: !!browser?.connected, pid: chromeProcess?.pid ?? null, visible, memory_mb: processTreeRssMb(chromeProcess?.pid) },
    queue: queued,
    interactive,
    watcher: { ...watcherHealth },
  };
}

export function killChrome(processHandle) {
  if (processHandle && processHandle.exitCode === null && processHandle.signalCode === null) {
    try {
      processHandle.kill("SIGKILL");
    } catch {}
  }
}

export function clearStaleProfileLock() {
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

export function assertDisplay() {
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    fail(
      CODES.NO_DISPLAY,
      "Não há tela disponível para abrir a janela do Aspa (DISPLAY/WAYLAND_DISPLAY vazios). Reinstale o serviço numa sessão gráfica com npm run install-service.",
    );
  }
}

export async function closeBrowser() {
  const current = browser;
  const processHandle = chromeProcess;
  browser = null;
  workPage = null;
  watchPage = null;
  chromeProcess = null;
  if (current?.connected) await current.close().catch(() => null);
  killChrome(processHandle);
}

export const PAGE_HELPERS = () => {
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

export const preparedPages = new WeakSet();

export async function preparePage(page) {
  if (!preparedPages.has(page)) {
    preparedPages.add(page);
    page.setDefaultTimeout(30000);
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => null));
    page.on("error", (error) => {
      console.error(`[chrome] tab crashed: ${error.message}`);
      if (workPage === page) workPage = null;
      if (watchPage === page) watchPage = null;
      page.close().catch(() => null);
    });
    await page.evaluateOnNewDocument(PAGE_HELPERS);
  }
  await page.evaluate(PAGE_HELPERS).catch(() => null);
  return page;
}

export async function ensureBrowser(headful = false) {
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

export function launchChrome(headful) {
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    userDataDir: PROFILE_DIR,
    headless: !headful,
    defaultViewport: headful ? null : { width: 1400, height: 900 },
    env: chromeEnv(),
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

export async function getWorkPage() {
  const b = await ensureBrowser();
  if (!workPage || workPage.isClosed()) workPage = await preparePage(await b.newPage());
  await workPage.bringToFront();
  return workPage;
}

export async function getWatchPage() {
  const b = await ensureBrowser();
  if (!watchPage || watchPage.isClosed()) {
    watchPage = await preparePage(await b.newPage());
    await watchPage.setViewport({ width: 1400, height: 900 });
  }
  return watchPage;
}

export const drain = () => queue;

export async function shutdown() {
  await closeBrowser().catch(() => {});
}

export const setInteractive = (mode) => {
  interactive = mode;
};
