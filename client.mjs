import { existsSync } from "node:fs";
import { request } from "node:http";
import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { AspaError, CODES } from "./errors.mjs";

function runtimeDir() {
  if (process.env.XDG_RUNTIME_DIR) return process.env.XDG_RUNTIME_DIR;
  const systemDefault = `/run/user/${process.getuid?.()}`;
  return existsSync(systemDefault) ? systemDefault : join(homedir(), ".local", "share", "aspa-mcp");
}

export const SOCKET_PATH = process.env.ASPA_SOCKET || join(runtimeDir(), "aspa-mcp.sock");

export function socketAlive(path = SOCKET_PATH) {
  return new Promise((resolve) => {
    const socket = connect(path);
    socket.setTimeout(2000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

export function call(method, args = {}, timeoutMs = 10 * 60 * 1000, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AspaError(CODES.CANCELLED, "Pedido cancelado pelo cliente."));
      return;
    }
    const body = JSON.stringify({ method, args });
    const req = request(
      { socketPath: SOCKET_PATH, path: "/call", method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            reject(new AspaError(CODES.INTERNAL, `Resposta inválida do serviço: ${data.slice(0, 200)}`));
            return;
          }
          if (parsed.ok) resolve(parsed.result);
          else reject(new AspaError(parsed.code ?? CODES.INTERNAL, parsed.error, parsed.details));
        });
      },
    );
    const onAbort = () => req.destroy(new AspaError(CODES.CANCELLED, "Pedido cancelado pelo cliente."));
    signal?.addEventListener("abort", onAbort, { once: true });
    req.setTimeout(timeoutMs, () => req.destroy(new AspaError(CODES.TIMEOUT, "O serviço do aspa-mcp não respondeu a tempo.")));
    req.on("close", () => signal?.removeEventListener("abort", onAbort));
    req.on("error", (error) => {
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") {
        reject(new AspaError(CODES.DAEMON_DOWN, "O serviço do aspa-mcp não está rodando. Inicie com: systemctl --user start aspa-mcp (ou npm run daemon)."));
      } else reject(error instanceof AspaError ? error : new AspaError(CODES.INTERNAL, error.message));
    });
    req.end(body);
  });
}
