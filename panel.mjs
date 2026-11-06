import { browser, sleep, watchPage } from "./browser.mjs";
import { CODES, fail } from "./errors.mjs";
import { APP_ORIGIN, ICON_LINE, LIST_URL } from "./ui-map.mjs";

export async function sessionState(page) {
  return page.evaluate(() => {
    const panel =
      document.querySelector("button.list-otps-btn, .wrp-feed-item") ||
      [...document.querySelectorAll("button")].some((b) => /Atendimento$/.test(b.innerText.trim()));
    if (panel) return "logged_in";
    if (document.querySelector("input[type=password]")) return "logged_out";
    return "loading";
  });
}

export async function waitForSession(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await sessionState(page).catch(() => "loading");
    if (state !== "loading") return state;
    await sleep(500);
  }
  return "loading";
}

export async function navigateToList(page) {
  if (page.url().startsWith(LIST_URL) && (await page.$("button.list-otps-btn"))) return;
  if (page.url().startsWith(APP_ORIGIN)) {
    const clicked = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) => /Atendimento$/.test(b.innerText.trim()));
      if (!button) return false;
      button.click();
      return true;
    });
    if (clicked) {
      const arrived = await page
        .waitForFunction((url) => location.href.startsWith(url) && document.querySelectorAll("button.list-otps-btn").length > 0, { timeout: 15000 }, LIST_URL)
        .then(() => true)
        .catch(() => false);
      if (arrived) return;
    }
  }
  await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
}

export async function ensureList(page, tab) {
  const onList = page.url() === LIST_URL || (page.url().startsWith(`${LIST_URL}/`) && (await page.$("button.list-otps-btn")));
  if (!onList) await navigateToList(page);
  if ((await waitForSession(page, 30000)) === "logged_out") fail(CODES.SESSION_EXPIRED, "A sessão do Aspa expirou ou não existe. Chame aspa_login para entrar de novo.");
  await page.waitForFunction(() => document.querySelectorAll("button.list-otps-btn").length > 0, { timeout: 60000 }).catch(() => null);
  if ((await activeFilterChips(page)).length) await clearListFilters(page);
  const clicked = await selectTab(page, tab ?? "todos");
  if (tab && !clicked) fail(CODES.UI_CHANGED, `A aba "${tab}" não foi encontrada no painel. Outro filtro da lista pode estar ativo; limpe-o no painel.`);
}

export async function selectTab(page, tab) {
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

export async function panelLoaded(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) => {
      const match = b.innerText.trim().match(/^Todos \((\d+)\)$/);
      return match && Number(match[1]) > 0;
    }),
  );
}

export async function readList(page) {
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

export const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export const comparable = (value) => normalizeText(value).replace(/\s+/g, " ").trim();

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

export async function currentConversation(page) {
  return page.evaluate(() => ({ header: document.querySelector(".header-main-txt h2")?.innerText.trim() ?? "", url: location.href }));
}

export async function assertStillOn(page, match) {
  const state = await currentConversation(page);
  const idChanged = match.conversation_id && conversationIdFrom(state.url) !== match.conversation_id;
  if (!sameContact(state.header, match.contact) || idChanged) {
    fail(
      CODES.WRONG_CONVERSATION,
      `A conversa aberta no painel mudou (esperado "${match.contact}", aberto "${state.header || "nenhuma"}"). Nada foi enviado ou alterado.`,
    );
  }
}

export async function openConversation(page, target, { write = false } = {}) {
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

export async function waitForStableFeed(page) {
  let previous = -1;
  for (let i = 0; i < 10; i++) {
    const count = await page.evaluate(() => document.querySelectorAll(".wrp-feed-item").length);
    if (count === previous) return;
    previous = count;
    await sleep(500);
  }
}

export async function loadMore(page, times) {
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

export async function readFeed(page) {
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

export async function clickHeaderIcon(page, iconName) {
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

export async function clickComposerPlus(page, item) {
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

export async function clickOverlay(page, selector, pattern) {
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

export async function overlayTexts(page, selector) {
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

export async function dialogOpen(page) {
  return page.evaluate(() => !!document.querySelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container)"));
}

export async function closeOverlays(page) {
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

export async function waitDialogClosed(page, timeout = 15000) {
  await page.waitForFunction(() => !document.querySelector(".cdk-overlay-container :is(mat-dialog-container, .mat-mdc-dialog-container)"), { timeout });
}

export async function chooseOption(page, wanted, what) {
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

export async function countSent(page) {
  return page.evaluate(() => document.querySelectorAll(".att-msg-sent").length);
}

export async function waitSentIncrease(page, before) {
  try {
    await page.waitForFunction((n) => document.querySelectorAll(".att-msg-sent").length > n, { timeout: 30000 }, before);
  } catch {
    fail(CODES.NOT_VERIFIED, "O painel não mostrou a mensagem nova em 30 s. Confira a conversa no Aspa antes de tentar de novo, para não enviar em dobro.");
  }
}

export async function lastSentText(page) {
  return page.evaluate(() => {
    const sent = [...document.querySelectorAll(".att-msg-sent")].at(-1);
    if (!sent) return "";
    return (window.__aspaText ? window.__aspaText(sent) : sent.innerText).trim();
  });
}

export function sentMatches(shown, text) {
  const a = comparable(shown);
  const b = comparable(text).slice(0, 60);
  return !!b && a.includes(b);
}

export async function activeFilterChips(page) {
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

export async function clearListFilters(page) {
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

export async function clickListMenuItem(page, label) {
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

export async function restoreUnread(page, match, keepUnread) {
  if (keepUnread === false || !match.unread) return undefined;
  return markUnreadInList(page, match.contact).catch(() => false);
}

export async function fillAndSend(page, text, match) {
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

export async function assumeButton(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Assumir" && b.offsetParent && !b.closest(".cdk-overlay-container")),
  );
}

export async function captureMediaUrl(page, attachment) {
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

async function leaveConversation(page) {
  if (!conversationIdFrom(page.url())) return;
  const left = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Painel de Estatísticas"));
    if (!button) return false;
    button.click();
    return true;
  });
  if (left) await page.waitForFunction(() => !location.pathname.startsWith("/atendimento"), { timeout: 15000 }).catch(() => null);
  if (!left || conversationIdFrom(page.url())) {
    await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
    return;
  }
  await navigateToList(page);
}

export async function markUnreadInList(page, contactName) {
  await navigateToList(page);
  await ensureList(page, null);
  if ((await readList(page)).find((i) => i.contact === contactName)?.unread) return true;
  await leaveConversation(page);
  await navigateToList(page);
  await ensureList(page, null);
  const item = (await readList(page)).find((i) => i.contact === contactName);
  if (!item) fail(CODES.NOT_FOUND, `A conversa "${contactName}" não está na lista de abertas.`);
  if (item.unread) return true;
  let chosen = false;
  let seen = [];
  for (let attempt = 0; attempt < 3 && !chosen; attempt++) {
    const handle = (await page.$$("button.list-otps-btn"))[item.index];
    await handle.click({ button: "right", offset: { x: 60, y: 18 } });
    for (let i = 0; i < 6 && !chosen; i++) {
      await sleep(500);
      chosen = await clickOverlay(page, "button, [role=menuitem]", "Marcar como não lida$");
    }
    if (!chosen) {
      seen = await overlayTexts(page, "button, [role=menuitem]");
      await closeOverlays(page);
    }
  }
  if (!chosen) fail(CODES.UI_CHANGED, `Não achei a opção Marcar como não lida. Menu: ${seen.join(" | ") || "não abriu"}`);
  const isUnread = async () => (await readList(page)).find((x) => x.contact === contactName)?.unread;
  for (let i = 0; i < 5; i++) {
    await sleep(800);
    if (await isUnread()) return true;
  }
  const left = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Painel de Estatísticas"));
    button?.click();
    return !!button;
  });
  if (!left) return false;
  await page.waitForFunction(() => !location.pathname.startsWith("/atendimento"), { timeout: 15000 }).catch(() => null);
  await navigateToList(page);
  await ensureList(page, null);
  return !!(await isUnread());
}

export async function pickCalendarDate(page, isoDate) {
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

export async function goToSection(page, buttonLabel, readySelectorOrText) {
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

export async function openContactsMenuItem(page, label) {
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

export async function searchContactIn(page, query) {
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

export const digitsOf = (value) => String(value ?? "").replace(/\D/g, "");
