import { exclusive, getWatchPage, interactive, watcherHealth } from "./browser.mjs";
import { activeFilterChips, clearListFilters, panelLoaded, readList, selectTab, waitForSession } from "./panel.mjs";
import { LIST_URL } from "./ui-map.mjs";

export const WATCH_RELOAD_MS = 30 * 60 * 1000;

export const DEGRADED_AFTER_MS = 5 * 60 * 1000;

export async function diagnose(page) {
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

export function startWatcher({ intervalMs, tabs = ["meus"], initialKnown, onActivity, onSessionLost, onDegraded, onRecovered, onFirstSnapshot, onState }) {
  let known = initialKnown?.length ? new Map(initialKnown) : null;
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
      } else {
        onFirstSnapshot?.([...next.values()]);
      }
      known = next;
      onState?.(next);
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
