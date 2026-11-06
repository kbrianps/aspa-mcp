import { execFile } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { call } from "./client.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

function run(command, args, timeout = 120000) {
  return new Promise((resolve) => {
    execFile(command, args, { cwd: ROOT, timeout, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, out: `${stdout}${stderr}`.trim(), error: error?.message });
    });
  });
}

const head = async () => (await run("git", ["rev-parse", "--short", "HEAD"])).out;

async function latestTarget() {
  const tags = (await run("git", ["tag", "--list", "v*", "--sort=-v:refname"])).out.split("\n").filter(Boolean);
  return tags[0] ?? "@{u}";
}

export async function checkForUpdate() {
  const fetched = await run("git", ["fetch", "--quiet", "--tags", "origin"], 20000);
  if (!fetched.ok) return { available: false, error: "Could not reach GitHub to check for updates." };
  const target = await latestTarget();
  const behind = Number((await run("git", ["rev-list", "--count", `HEAD..${target}`])).out || 0);
  const latest = (await run("git", ["log", "-1", "--format=%h %s", target])).out;
  return { available: behind > 0, behind, current: await head(), target, latest };
}

async function installDependencies() {
  const npm = await run("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-fund", "--no-audit"], 300000);
  if (!npm.ok) throw new Error(`npm ci failed: ${npm.out || npm.error}`);
}

export async function update({ restartService = true } = {}) {
  const before = await head();
  const dirty = (await run("git", ["status", "--porcelain", "--untracked-files=no"])).out;
  if (dirty) throw new Error("There are local changes to the aspa-mcp code; update manually with git to avoid losing them.");
  const status = await checkForUpdate();
  if (status.error) throw new Error(status.error);
  if (!status.available) return { updated: false, version: before, message: "Already on the latest version." };
  const changedFiles = (await run("git", ["diff", "--name-only", "HEAD", status.target])).out.split("\n").filter(Boolean);
  const merged = await run("git", ["merge", "--ff-only", "--quiet", status.target]);
  if (!merged.ok) throw new Error(`git merge failed: ${merged.out || merged.error}`);
  let installed = "skipped (dependencies unchanged)";
  if (changedFiles.some((file) => /^package(-lock)?\.json$/.test(file))) {
    try {
      await installDependencies();
      installed = "done";
    } catch (error) {
      await run("git", ["reset", "--keep", before]);
      await installDependencies().catch(() => null);
      throw new Error(`${error.message}. Rolled back to ${before}.`);
    }
  }
  let service = "not restarted";
  const busy = restartService ? await call("health", {}, 10000).then((h) => h.interactive || (h.queue > 0 ? "queue" : null)).catch(() => null) : null;
  if (busy) {
    service = "not restarted: an Aspa window or action is in progress; run systemctl --user restart aspa-mcp when it finishes";
  } else if (restartService) {
    const active = await run("systemctl", ["--user", "is-enabled", "aspa-mcp"]);
    if (active.ok) {
      const restarted = await run("systemctl", ["--user", "restart", "aspa-mcp"]);
      service = restarted.ok ? "restarted" : `restart failed: ${restarted.out || restarted.error}`;
    } else {
      service = "no systemd service found; restart npm run daemon manually";
    }
  }
  return {
    updated: true,
    from: before,
    to: await head(),
    version: status.target,
    commits: status.behind,
    latest: status.latest,
    dependencies: installed,
    service,
    next: "Reload the MCP in the client to see new tools: Claude Code /mcp then Reconnect aspa; Codex: close and reopen.",
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  update()
    .then((result) => {
      if (!result.updated) {
        console.log(`aspa-mcp já está na versão mais nova (${result.version}).`);
        return;
      }
      console.log(`aspa-mcp atualizado: ${result.from} -> ${result.to} (${result.version}, ${result.commits} commit(s)).`);
      console.log(`Última mudança: ${result.latest}`);
      console.log(`Dependências: ${result.dependencies}. Serviço: ${result.service}.`);
      console.log("Agora recarregue o MCP no cliente: Claude Code /mcp -> Reconnect aspa; Codex: feche e abra.");
    })
    .catch((error) => {
      console.error(`Não foi possível atualizar: ${error.message}`);
      process.exit(1);
    });
}
