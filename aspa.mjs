import { existsSync, mkdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, relative, sep } from "node:path";
import { assertDisplay, browser, CACHE_DIR, closeBrowser, ensureBrowser, exclusive, getWorkPage, MAX_ATTACHMENT_BYTES, PROFILE_DIR, setInteractive, sleep, workPage } from "./browser.mjs";
import { CODES, fail } from "./errors.mjs";
import { assertStillOn, assumeButton, navigateToList, sameContact, captureMediaUrl, chooseOption, clearListFilters, clickComposerPlus, clickHeaderIcon, clickListMenuItem, clickOverlay, closeOverlays, comparable, countSent, dialogOpen, digitsOf, ensureList, fillAndSend, goToSection, loadMore, markUnreadInList, normalizeText, openContactsMenuItem, openConversation, overlayTexts, pickCalendarDate, pickConversation, readFeed, readList, restoreUnread, searchContactIn, sessionState, waitDialogClosed, waitForSession, waitSentIncrease } from "./panel.mjs";
import { transcribeFiles, transcriptionEnabled } from "./transcription.mjs";
import { APP_ORIGIN, LIST_FILTERS, LIST_ORDER, LIST_URL, SNOOZE_LABELS } from "./ui-map.mjs";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export function login({ onFinished } = {}) {
  let reportOpened;
  const opened = new Promise((resolve) => (reportOpened = resolve));
  exclusive(async () => {
    assertDisplay();
    setInteractive("login");
    let reason = "timeout";
    try {
      await closeBrowser();
      await ensureBrowser(true);
      const page = workPage;
      await page.goto(LIST_URL, { waitUntil: "domcontentloaded" });
      await page.bringToFront();
      reportOpened({ opened: true, window_minutes: LOGIN_TIMEOUT_MS / 60000, profile: PROFILE_DIR });
      const deadline = Date.now() + LOGIN_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (!browser?.connected || page.isClosed()) {
          reason = "closed_by_user";
          break;
        }
        if ((await sessionState(page).catch(() => "loading")) === "logged_in") {
          await sleep(2000);
          reason = "logged_in";
          break;
        }
        await sleep(1000);
      }
    } catch (error) {
      reportOpened({ error });
      reason = "error";
    } finally {
      setInteractive(null);
      await closeBrowser().catch(() => null);
      onFinished?.({ loggedIn: reason === "logged_in", reason });
    }
  }).catch((error) => reportOpened({ error }));
  return opened.then((result) => {
    if (result.error) throw result.error;
    return result;
  });
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

export const readConversation = ({ index, contact, loadMoreTimes = 0, keepUnread = true } = {}) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    if (loadMoreTimes > 0) await loadMore(page, loadMoreTimes);
    const feed = { conversation_id: match.conversation_id, ...(await readFeed(page)) };
    feed.kept_unread = await restoreUnread(page, match, keepUnread);
    return feed;
  });

export const sendMessage = ({ index, contact, conversation_id, text }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    const verified = await fillAndSend(page, text, match);
    return { sent: true, contact: match.contact, conversation_id: match.conversation_id, verified };
  });

export const listTemplates = ({ index, contact, keepUnread = true }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
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
    return { templates, kept_unread: await restoreUnread(page, match, keepUnread) };
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
    const chosen = await chooseOption(page, to, "Destino");
    const transferEvents = () =>
      page.evaluate(() => [...document.querySelectorAll(".wrp-feed-item")].filter((e) => !e.querySelector(".att-msg") && /transferiu/i.test(e.innerText)).length);
    const eventsBefore = await transferEvents();
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
    let verified = false;
    for (let i = 0; i < 20 && !verified; i++) {
      await sleep(500);
      verified = (await transferEvents().catch(() => eventsBefore)) > eventsBefore;
    }
    return { transferred: true, contact: match.contact, to: chosen, verified };
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
    await navigateToList(page);
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
    await navigateToList(page);
    await openConversation(page, { contact: name }).catch(() => openConversation(page, { contact: match.contact }));
    await sleep(1500);
    const shown = await page.evaluate(() => ({
      header: document.querySelector(".header-main-txt h2")?.innerText.trim() ?? "",
      field: [...document.querySelectorAll("input")].find((e) => e.getBoundingClientRect().x > 1000 && !e.readOnly && !e.disabled)?.value ?? "",
    }));
    const verified = shown.field === name || comparable(shown.header) === comparable(name);
    return { renamed: verified, verified, previous, saved: shown.field || shown.header, contact: match.contact };
  });

export const transcribeAudio = async ({ index, contact, loadMoreTimes = 0, messageIndexes, keepUnread = true }) => {
  if (!transcriptionEnabled()) await transcribeFiles([]);
  const downloaded = await downloadAttachments({ index, contact, loadMoreTimes, messageIndexes, keepUnread });
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

export const downloadAttachments = ({ index, contact, loadMoreTimes = 0, messageIndexes, keepUnread = true }) =>
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
    return { contact: match.contact, folder, files, kept_unread: await restoreUnread(page, match, keepUnread) };
  });

export const markUnread = ({ index, contact }) =>
  exclusive(async () => {
    if (!String(contact ?? "").trim()) fail(CODES.INVALID_INPUT, "Informe o nome do contato (contact).");
    const page = await getWorkPage();
    await navigateToList(page);
    await ensureList(page, null);
    const match = pickConversation(await readList(page), { index, contact });
    if (!match) fail(CODES.NOT_FOUND, "Conversa não encontrada na lista de conversas abertas.");
    const verified = await markUnreadInList(page, match.contact);
    return { marked_unread: verified, contact: match.contact, verified };
  });

export const searchConversation = ({ index, contact, query, loadMoreTimes = 3, keepUnread = true }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact });
    if (loadMoreTimes > 0) await loadMore(page, loadMoreTimes);
    const feed = await readFeed(page);
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    const matches = feed.items.filter((item) => terms.every((term) => normalizeText(item.text).includes(term)));
    return { contact: feed.contact, query, searched_items: feed.items.length, matches, kept_unread: await restoreUnread(page, match, keepUnread) };
  });

export const replyToMessage = ({ index, contact, conversation_id, messageIndex, quoted_text, text, loadMoreTimes = 0 }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const match = await openConversation(page, { index, contact, conversation_id }, { write: true });
    if (loadMoreTimes > 0) await loadMore(page, loadMoreTimes);
    const feed = await readFeed(page);
    const target = feed.items.find((item) => item.index === messageIndex);
    if (!target || target.type !== "message") fail(CODES.NOT_FOUND, `Mensagem ${messageIndex} não encontrada. Leia a conversa de novo e use o índice dela.`);
    if (!String(quoted_text ?? "").trim() || !comparable(target.text).includes(comparable(quoted_text))) {
      fail(
        CODES.WRONG_CONVERSATION,
        `A mensagem ${messageIndex} não contém o trecho "${String(quoted_text ?? "").slice(0, 60)}" (ela diz: "${String(target.text ?? "").slice(0, 80)}"). Leia a conversa de novo antes de responder.`,
      );
    }
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
    await navigateToList(page);
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
    await navigateToList(page);
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
    await navigateToList(page);
    return data;
  });

export const searchContact = ({ query }) =>
  exclusive(async () => {
    const page = await getWorkPage();
    return searchContactIn(page, query);
  });

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
    setInteractive("review");
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
      setInteractive(null);
      await closeBrowser().catch(() => null);
    }
  }).catch((error) => reportOpened({ error }));
  return opened.then((result) => {
    if (result.error) throw result.error;
    return result;
  });
}

export { drain, health, interactiveMode, pruneAttachments, recycleChromeIfHeavy, shutdown, withRequest } from "./browser.mjs";
export { conversationIdFrom, pickConversation, sameContact } from "./panel.mjs";
export { isActivity, startWatcher } from "./watcher.mjs";

export const doctor = ({ contact } = {}) =>
  exclusive(async () => {
    const page = await getWorkPage();
    const checks = [];
    const check = (id, ok, detail) => checks.push({ id, ok: !!ok, detail });
    await ensureList(page, null);
    const list = await page.evaluate(() => ({
      items: document.querySelectorAll("button.list-otps-btn").length,
      tabs: [...document.querySelectorAll("button")].filter((b) => /^(Todos|Meus|Pendentes) \(\d+\)$/.test(b.innerText.trim())).length,
      filterMenu: [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "filter_alt"),
      contactsMenu: [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "more_vert"),
      times: document.querySelectorAll("button.list-otps-btn .obtn-time").length,
    }));
    check("lista_de_conversas", list.items > 0, `${list.items} conversas`);
    check("abas", list.tabs === 3, `${list.tabs} de 3 abas (Todos, Meus, Pendentes)`);
    check("horario_na_lista", list.times === list.items, `${list.times} de ${list.items} com horário`);
    check("menu_de_filtros", list.filterMenu, "botão filter_alt");
    check("menu_de_contatos", list.contactsMenu, "botão more_vert");
    const items = await readList(page);
    check("nomes_na_lista", items.length > 0 && items.every((item) => item.contact), "todas as conversas com nome");
    if (contact) {
      const match = await openConversation(page, { contact });
      const view = await page.evaluate(() => {
        const icons = [...document.querySelectorAll("button")].map((b) => b.innerText.trim());
        return {
          header: document.querySelector(".header-main-txt h2")?.innerText.trim() ?? "",
          feed: document.querySelectorAll(".wrp-feed-item").length,
          composer: !!document.querySelector("textarea.cdk-textarea-autosize"),
          assume: icons.includes("Assumir"),
          actions: ["swap_horiz", "alarm", "task_alt"].filter((name) => icons.includes(name)),
        };
      });
      check("cabecalho_da_conversa", sameContact(view.header, match.contact), view.header);
      check("historico", view.feed > 0, `${view.feed} itens`);
      check("caixa_de_resposta", view.composer || view.assume, view.composer ? "caixa de resposta" : "botão Assumir");
      check("acoes_do_cabecalho", view.actions.length === 3, view.actions.join(", "));
      const feed = await readFeed(page);
      check("leitura_das_mensagens", feed.items.some((item) => item.type === "message"), `${feed.items.length} itens lidos`);
      await restoreUnread(page, match, true);
    }
    return { ok: checks.every((c) => c.ok), checks };
  });
